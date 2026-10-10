'use client'

import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBackward, faForward, faMusic, faPause, faPlay, faRightLeft, faVolumeHigh } from '@fortawesome/free-solid-svg-icons'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'
import { copy, formatCopy } from '@/app/copy'

type SpotifyDevice = {
  id: string
  name: string
  type: string
  is_active?: boolean
  is_restricted?: boolean
  volume_percent?: number | null
  supports_volume?: boolean
}

type SpotifyTrack = {
  name: string
  type: string
  artists?: Array<{ name: string }>
  album?: { images?: Array<{ url: string }> }
}

type SpotifyPlayback = {
  is_playing: boolean
  progress_ms: number | null
  item: SpotifyTrack | null
  device: SpotifyDevice | null
  actions?: { disallows?: Record<string, boolean> }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDevice(value: unknown): value is SpotifyDevice {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && (value.is_active === undefined || typeof value.is_active === 'boolean')
    && (value.is_restricted === undefined || typeof value.is_restricted === 'boolean')
    && (value.supports_volume === undefined || typeof value.supports_volume === 'boolean')
    && (value.volume_percent === undefined || value.volume_percent === null ||
      (typeof value.volume_percent === 'number' && Number.isInteger(value.volume_percent) && value.volume_percent >= 0 && value.volume_percent <= 100))
}

function isTrack(value: unknown): value is SpotifyTrack {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.type !== 'string') return false
  if (value.artists !== undefined && (!Array.isArray(value.artists) || !value.artists.every((artist) => isRecord(artist) && typeof artist.name === 'string'))) return false
  if (value.album !== undefined) {
    if (!isRecord(value.album)) return false
    const images = value.album.images
    if (images !== undefined && (!Array.isArray(images) || !images.every((image) => isRecord(image) && typeof image.url === 'string'))) return false
  }
  return true
}

function isPlayback(value: unknown): value is SpotifyPlayback {
  if (!isRecord(value) || typeof value.is_playing !== 'boolean') return false
  if (value.progress_ms !== null && (typeof value.progress_ms !== 'number' || !Number.isFinite(value.progress_ms) || value.progress_ms < 0)) return false
  if (value.item !== null && !isTrack(value.item)) return false
  if (value.device !== null && !isDevice(value.device)) return false
  if (value.actions !== undefined) {
    if (!isRecord(value.actions)) return false
    if (value.actions.disallows !== undefined && (!isRecord(value.actions.disallows) ||
      !Object.values(value.actions.disallows).every((allowed) => typeof allowed === 'boolean'))) return false
  }
  return true
}

function durationLabel(milliseconds: number | null) {
  if (milliseconds === null) return null
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function SpotifyPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.spotify')
  const [playback, setPlayback] = useState<SpotifyPlayback | null>(null)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [volume, setVolume] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileResult, setProfileResult] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [playbackResponse, devicesResponse] = await Promise.all([
        fetch('/api/spotify/player/playback', { cache: 'no-store' }),
        fetch('/api/spotify/player/devices', { cache: 'no-store' }),
      ])
      const [playbackResult, devicesResult]: [unknown, unknown] = await Promise.all([
        playbackResponse.json(), devicesResponse.json(),
      ])
      if (!playbackResponse.ok || !devicesResponse.ok) throw new Error(copy.spotify.loadError)
      if (playbackResult !== null && !isPlayback(playbackResult)) throw new Error(copy.spotify.invalidPlayback)
      const deviceList = isRecord(devicesResult) ? devicesResult.devices : null
      if (!Array.isArray(deviceList) || !deviceList.every(isDevice)) throw new Error(copy.spotify.invalidDevices)
      setPlayback(playbackResult)
      setDevices(deviceList)
      setSelectedDeviceId((current) => current || playbackResult?.device?.id || deviceList.find((device) => device.is_active)?.id || deviceList[0]?.id || '')
      const activeDevice = deviceList.find((device) => device.id === (playbackResult?.device?.id || selectedDeviceId))
      if (activeDevice?.volume_percent != null) setVolume(activeDevice.volume_percent)
      setError(null)
    } catch (reason) {
      setError(copy.spotify.unavailable)
    } finally {
      setLoading(false)
    }
  }, [selectedDeviceId])

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return
    void refresh()
    const interval = window.setInterval(() => void refresh(), 15_000)
    return () => window.clearInterval(interval)
  }, [autoFetch.ready, autoFetch.enabled, refresh, refreshToken])

  async function sendCommand(path: 'pause' | 'resume' | 'previous' | 'next' | 'transfer' | 'volume', payload: Record<string, unknown> = {}) {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/spotify/player/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        setMessage(copy.spotify.commandFailed)
      } else {
        setMessage(copy.spotify.commandMessages[path])
        setRefreshToken((value) => value + 1)
      }
    } catch {
      setMessage(copy.spotify.unreachable)
    } finally {
      setBusy(false)
    }
  }

  async function testProfile() {
    if (profileBusy) return
    setProfileBusy(true)
    setProfileResult(null)
    try {
      const response = await fetch('/api/spotify/player/me', { cache: 'no-store' })
      const result: unknown = await response.json()
      if (!response.ok) {
        setProfileResult(copy.spotify.profileLoadError)
      } else if (!isRecord(result)) {
        setProfileResult(copy.spotify.invalidProfile)
      } else {
        const displayName = typeof result.display_name === 'string' ? result.display_name : copy.spotify.notSet
        const userId = typeof result.id === 'string' ? result.id : copy.spotify.notReturned
        const accountType = typeof result.product === 'string' ? result.product : copy.spotify.notReturned
        setProfileResult(formatCopy(copy.spotify.profileAvailable, { name: displayName, id: userId, type: accountType }))
      }
    } catch {
      setProfileResult(copy.spotify.profileServiceError)
    } finally {
      setProfileBusy(false)
    }
  }

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null
  const track = playback?.item ?? null
  const image = track?.album?.images?.[0]?.url
  const artistNames = track?.artists?.map((artist) => artist.name).join(', ')
  const progress = durationLabel(playback?.progress_ms ?? null)
  const controlsDisabled = busy
  const volumeDisabled = controlsDisabled || !selectedDeviceId || selectedDevice?.supports_volume === false
  const disallowedActions = playback?.actions?.disallows ?? {}
  const playbackDeviceId = playback?.device?.id

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="spotify-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faMusic} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.spotify.eyebrow}</p>
          <h2 id="spotify-heading">{copy.spotify.title}</h2>
        </div>
        <AutoRefreshControl
          label={copy.spotify.title}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void refresh()}
          refreshLabel={copy.spotify.refresh}
          refreshing={loading}
        />
      </div>

      <p className="dashboard-live-message" role="status" aria-live="polite">
        {loading ? copy.spotify.loading : error ? error : autoFetch.ready && !autoFetch.enabled && !playback ? null : playback?.is_playing && !playback.item ? copy.spotify.activeWithoutTrack : !playback?.item ? copy.spotify.nothingPlaying : null}
      </p>
      {!loading && !error && track && (
        <div style={{ display: 'grid', gridTemplateColumns: image ? '72px minmax(0, 1fr)' : '1fr', gap: 14, alignItems: 'center', marginTop: 12 }}>
          {image && <img src={image} alt="" width="72" height="72" style={{ borderRadius: 10, objectFit: 'cover' }} />}
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }} aria-live="polite">
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</strong>
            <span className="dashboard-live-label">{artistNames || (track.type === 'episode' ? copy.spotify.episode : copy.spotify.title)}</span>
            {progress && <span className="dashboard-live-label">{playback?.is_playing ? copy.spotify.playing : copy.spotify.paused} · {formatCopy(copy.spotify.played, { duration: progress })}</span>}
          </div>
        </div>
      )}

      {!loading && !error && devices.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <label className="dashboard-live-label" htmlFor="spotify-device">{copy.spotify.device}</label>
          <select id="spotify-device" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} disabled={controlsDisabled} style={{ minHeight: 42, padding: '0 10px', borderRadius: 10, color: 'inherit', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', font: 'inherit' }}>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.is_active ? ` · ${copy.spotify.active}` : ''}</option>)}
          </select>
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void sendCommand('transfer', { deviceId: selectedDeviceId, play: Boolean(playback?.is_playing) })} disabled={controlsDisabled || !selectedDeviceId || selectedDeviceId === playback?.device?.id}><FontAwesomeIcon icon={faRightLeft} aria-hidden="true" /> {copy.spotify.transfer}</button>
          </div>
          <label className="dashboard-live-label" htmlFor="spotify-volume" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <span>{selectedDevice ? formatCopy(copy.spotify.volumeFor, { device: selectedDevice.name }) : copy.spotify.volume}</span><span>{volume}%</span>
            <input id="spotify-volume" type="range" min="0" max="100" step="1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={volumeDisabled} aria-label={copy.spotify.volumeAria} style={{ gridColumn: '1 / -1', width: '100%', accentColor: '#f4bd84' }} />
          </label>
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void sendCommand('volume', { deviceId: selectedDeviceId, volumePercent: volume })} disabled={volumeDisabled}><FontAwesomeIcon icon={faVolumeHigh} aria-hidden="true" /> {copy.spotify.setVolume}</button>
          </div>
          {selectedDevice?.supports_volume === false && <p className="dashboard-live-message">{copy.spotify.volumeUnsupported}</p>}
        </div>
      )}

      {!loading && !error && devices.length === 0 && <p className="dashboard-live-message">{copy.spotify.noDevices}</p>}

      <div className="dashboard-control-actions-row" style={{ marginTop: 18 }}>
        <button type="button" onClick={() => void sendCommand('previous', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.skipping_prev === true}><FontAwesomeIcon icon={faBackward} aria-hidden="true" /> {copy.spotify.previous}</button>
        {playback?.is_playing ? (
          <button type="button" onClick={() => void sendCommand('pause', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || disallowedActions.pausing === true}><FontAwesomeIcon icon={faPause} aria-hidden="true" /> {copy.spotify.pause}</button>
        ) : (
          <button type="button" onClick={() => void sendCommand('resume', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.resuming === true}><FontAwesomeIcon icon={faPlay} aria-hidden="true" /> {copy.spotify.resume}</button>
        )}
        <button type="button" onClick={() => void sendCommand('next', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.skipping_next === true}><FontAwesomeIcon icon={faForward} aria-hidden="true" /> {copy.spotify.next}</button>
      </div>
      <div className="dashboard-control-actions-row" style={{ marginTop: 10, gridTemplateColumns: '1fr' }}>
        <a href="/api/spotify/auth/start" className="dashboard-control-lock" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minHeight: 42, padding: '0 12px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, color: '#c5cad4', background: 'transparent', font: 'inherit', textDecoration: 'none' }}><FontAwesomeIcon icon={faMusic} aria-hidden="true" /> {copy.spotify.authorize}</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button type="button" onClick={() => void testProfile()} disabled={profileBusy}>
          {profileBusy ? copy.spotify.testing : copy.spotify.testProfile}
        </button>
        <p className="dashboard-control-message" role="status" aria-live="polite" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {profileResult || copy.spotify.profileNotTested}
        </p>
      </div>
      <p className="dashboard-control-message" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
