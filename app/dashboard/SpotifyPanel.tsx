'use client'

import { useCallback, useEffect, useState } from 'react'
import { AutoFetchSwitch, useAutoFetch } from './useAutoFetch'

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

function responseError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === 'string' ? value.error : fallback
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
      if (!playbackResponse.ok) throw new Error(responseError(playbackResult, 'Spotify playback is unavailable'))
      if (!devicesResponse.ok) throw new Error(responseError(devicesResult, 'Spotify devices are unavailable'))
      if (playbackResult !== null && !isPlayback(playbackResult)) throw new Error('Spotify returned an invalid playback response')
      const deviceList = isRecord(devicesResult) ? devicesResult.devices : null
      if (!Array.isArray(deviceList) || !deviceList.every(isDevice)) throw new Error('Spotify returned an invalid device list')
      setPlayback(playbackResult)
      setDevices(deviceList)
      setSelectedDeviceId((current) => current || playbackResult?.device?.id || deviceList.find((device) => device.is_active)?.id || deviceList[0]?.id || '')
      const activeDevice = deviceList.find((device) => device.id === (playbackResult?.device?.id || selectedDeviceId))
      if (activeDevice?.volume_percent != null) setVolume(activeDevice.volume_percent)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Spotify player is unavailable')
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
        const result: unknown = await response.json().catch(() => null)
        setMessage(responseError(result, `Spotify could not ${path} playback.`))
      } else {
        setMessage(path === 'volume' ? 'Volume updated.' : path === 'transfer' ? 'Playback transferred.' : `${path[0].toUpperCase()}${path.slice(1)} command sent.`)
        setRefreshToken((value) => value + 1)
      }
    } catch {
      setMessage('Spotify could not be reached. Check your connection and try again.')
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
        setProfileResult(responseError(result, `Spotify /me request failed (${response.status})`))
      } else if (!isRecord(result)) {
        setProfileResult('Spotify returned an invalid profile response.')
      } else {
        const displayName = typeof result.display_name === 'string' ? result.display_name : '(not set)'
        const userId = typeof result.id === 'string' ? result.id : '(not returned)'
        const accountType = typeof result.product === 'string' ? result.product : '(not returned)'
        setProfileResult(`Profile OK · ${displayName} · ${userId} · ${accountType}`)
      }
    } catch {
      setProfileResult('Could not reach the Spotify /me test endpoint.')
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
        <span className="dashboard-module-icon" aria-hidden="true">♫</span>
        <div>
          <p className="dashboard-eyebrow">Music</p>
          <h2 id="spotify-heading">Spotify</h2>
        </div>
        <div className="dashboard-header-controls">
          <AutoFetchSwitch label="Spotify" {...autoFetch} onChange={autoFetch.setEnabled} />
        <button
          className="dashboard-header-refresh"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh Spotify player"
        >Refresh</button>
        </div>
      </div>

      <p className="dashboard-live-message" role="status" aria-live="polite">
        {loading ? 'Loading Spotify player…' : error ? error : autoFetch.ready && !autoFetch.enabled && !playback ? 'Automatic updates are off. Refresh to load Spotify.' : playback?.is_playing && !playback.item ? 'Playback is active, but Spotify did not return track details.' : !playback?.item ? 'Nothing is playing. Start playback on a Spotify Connect device to enable track controls.' : null}
      </p>
      {!loading && !error && track && (
        <div style={{ display: 'grid', gridTemplateColumns: image ? '72px minmax(0, 1fr)' : '1fr', gap: 14, alignItems: 'center', marginTop: 12 }}>
          {image && <img src={image} alt="" width="72" height="72" style={{ borderRadius: 10, objectFit: 'cover' }} />}
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }} aria-live="polite">
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</strong>
            <span className="dashboard-live-label">{artistNames || (track.type === 'episode' ? 'Podcast episode' : 'Spotify')}</span>
            {progress && <span className="dashboard-live-label">{playback?.is_playing ? 'Playing' : 'Paused'} · {progress} elapsed</span>}
          </div>
        </div>
      )}

      {!loading && !error && devices.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <label className="dashboard-live-label" htmlFor="spotify-device">Spotify Connect device</label>
          <select id="spotify-device" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} disabled={controlsDisabled} style={{ minHeight: 42, padding: '0 10px', borderRadius: 10, color: 'inherit', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', font: 'inherit' }}>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.is_active ? ' · Active' : ''}</option>)}
          </select>
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void sendCommand('transfer', { deviceId: selectedDeviceId, play: Boolean(playback?.is_playing) })} disabled={controlsDisabled || !selectedDeviceId || selectedDeviceId === playback?.device?.id}>Transfer playback</button>
          </div>
          <label className="dashboard-live-label" htmlFor="spotify-volume" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <span>Volume{selectedDevice ? ` · ${selectedDevice.name}` : ''}</span><span>{volume}%</span>
            <input id="spotify-volume" type="range" min="0" max="100" step="1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={volumeDisabled} aria-label="Spotify volume" style={{ gridColumn: '1 / -1', width: '100%', accentColor: '#f4bd84' }} />
          </label>
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void sendCommand('volume', { deviceId: selectedDeviceId, volumePercent: volume })} disabled={volumeDisabled}>Set volume</button>
          </div>
          {selectedDevice?.supports_volume === false && <p className="dashboard-live-message">Spotify does not support remote volume control for this device. Change volume on the device itself.</p>}
        </div>
      )}

      {!loading && !error && devices.length === 0 && <p className="dashboard-live-message">No Spotify Connect devices are available. Open Spotify on a device and refresh.</p>}

      <div className="dashboard-control-actions-row" style={{ marginTop: 18 }}>
        <button type="button" onClick={() => void sendCommand('previous', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.skipping_prev === true}>Previous</button>
        {playback?.is_playing ? (
          <button type="button" onClick={() => void sendCommand('pause', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || disallowedActions.pausing === true}>Pause</button>
        ) : (
          <button type="button" onClick={() => void sendCommand('resume', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.resuming === true}>Resume</button>
        )}
        <button type="button" onClick={() => void sendCommand('next', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.skipping_next === true}>Next</button>
      </div>
      <div className="dashboard-control-actions-row" style={{ marginTop: 10, gridTemplateColumns: '1fr' }}>
        <a href="/api/spotify/auth/start" className="dashboard-control-lock" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minHeight: 42, padding: '0 12px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, color: '#c5cad4', background: 'transparent', font: 'inherit', textDecoration: 'none' }}>Connect or reauthorize Spotify</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button type="button" onClick={() => void testProfile()} disabled={profileBusy}>
          {profileBusy ? 'Testing…' : 'Test /me'}
        </button>
        <p className="dashboard-control-message" role="status" aria-live="polite" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {profileResult || 'Spotify profile test has not run.'}
        </p>
      </div>
      <p className="dashboard-control-message" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
