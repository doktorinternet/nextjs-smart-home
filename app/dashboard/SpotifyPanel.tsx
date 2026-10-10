'use client'

import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBackward, faForward, faMusic, faPause, faPlay, faRightLeft, faVolumeHigh } from '@fortawesome/free-solid-svg-icons'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'

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
      if (!playbackResponse.ok || !devicesResponse.ok) throw new Error('Det gick inte att hämta Spotify-uppspelningen.')
      if (playbackResult !== null && !isPlayback(playbackResult)) throw new Error('Spotify returnerade ett ogiltigt uppspelningssvar.')
      const deviceList = isRecord(devicesResult) ? devicesResult.devices : null
      if (!Array.isArray(deviceList) || !deviceList.every(isDevice)) throw new Error('Spotify returnerade en ogiltig enhetslista.')
      setPlayback(playbackResult)
      setDevices(deviceList)
      setSelectedDeviceId((current) => current || playbackResult?.device?.id || deviceList.find((device) => device.is_active)?.id || deviceList[0]?.id || '')
      const activeDevice = deviceList.find((device) => device.id === (playbackResult?.device?.id || selectedDeviceId))
      if (activeDevice?.volume_percent != null) setVolume(activeDevice.volume_percent)
      setError(null)
    } catch (reason) {
      setError('Spotify-spelaren är inte tillgänglig.')
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
        setMessage('Spotify-kommandot misslyckades. Kontrollera anslutningen och försök igen.')
      } else {
        const commandMessages = {
          pause: 'Uppspelningen pausades.',
          resume: 'Uppspelningen återupptogs.',
          previous: 'Föregående spår startades.',
          next: 'Nästa spår startades.',
          transfer: 'Uppspelningen flyttades.',
          volume: 'Volymen uppdaterades.',
        }
        setMessage(commandMessages[path])
        setRefreshToken((value) => value + 1)
      }
    } catch {
      setMessage('Det gick inte att nå Spotify. Kontrollera anslutningen och försök igen.')
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
        setProfileResult('Det gick inte att hämta Spotify-profilen.')
      } else if (!isRecord(result)) {
        setProfileResult('Spotify returnerade ett ogiltigt profilsvar.')
      } else {
        const displayName = typeof result.display_name === 'string' ? result.display_name : '(not set)'
        const userId = typeof result.id === 'string' ? result.id : '(not returned)'
        const accountType = typeof result.product === 'string' ? result.product : '(not returned)'
        setProfileResult(`Profilen är tillgänglig · ${displayName} · ${userId} · ${accountType}`)
      }
    } catch {
      setProfileResult('Det gick inte att nå Spotifys profiltjänst.')
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
          <p className="dashboard-eyebrow">Musik</p>
          <h2 id="spotify-heading">Spotify</h2>
        </div>
        <AutoRefreshControl
          label="Spotify"
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void refresh()}
          refreshLabel="Uppdatera Spotify-spelaren"
          refreshing={loading}
        />
      </div>

      <p className="dashboard-live-message" role="status" aria-live="polite">
        {loading ? 'Hämtar Spotify-spelaren…' : error ? error : autoFetch.ready && !autoFetch.enabled && !playback ? null : playback?.is_playing && !playback.item ? 'Uppspelningen är aktiv, men Spotify skickade inga låtuppgifter.' : !playback?.item ? 'Inget spelas just nu. Starta uppspelning på en Spotify Connect-enhet för att aktivera kontrollerna.' : null}
      </p>
      {!loading && !error && track && (
        <div style={{ display: 'grid', gridTemplateColumns: image ? '72px minmax(0, 1fr)' : '1fr', gap: 14, alignItems: 'center', marginTop: 12 }}>
          {image && <img src={image} alt="" width="72" height="72" style={{ borderRadius: 10, objectFit: 'cover' }} />}
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }} aria-live="polite">
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</strong>
            <span className="dashboard-live-label">{artistNames || (track.type === 'episode' ? 'Podcastavsnitt' : 'Spotify')}</span>
            {progress && <span className="dashboard-live-label">{playback?.is_playing ? 'Spelas' : 'Pausad'} · {progress} har spelats</span>}
          </div>
        </div>
      )}

      {!loading && !error && devices.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <label className="dashboard-live-label" htmlFor="spotify-device">Spotify Connect-enhet</label>
          <select id="spotify-device" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} disabled={controlsDisabled} style={{ minHeight: 42, padding: '0 10px', borderRadius: 10, color: 'inherit', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', font: 'inherit' }}>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.is_active ? ' · Aktiv' : ''}</option>)}
          </select>
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void sendCommand('transfer', { deviceId: selectedDeviceId, play: Boolean(playback?.is_playing) })} disabled={controlsDisabled || !selectedDeviceId || selectedDeviceId === playback?.device?.id}><FontAwesomeIcon icon={faRightLeft} aria-hidden="true" /> Flytta uppspelningen</button>
          </div>
          <label className="dashboard-live-label" htmlFor="spotify-volume" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <span>Volym{selectedDevice ? ` · ${selectedDevice.name}` : ''}</span><span>{volume}%</span>
            <input id="spotify-volume" type="range" min="0" max="100" step="1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={volumeDisabled} aria-label="Spotify-volym" style={{ gridColumn: '1 / -1', width: '100%', accentColor: '#f4bd84' }} />
          </label>
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void sendCommand('volume', { deviceId: selectedDeviceId, volumePercent: volume })} disabled={volumeDisabled}><FontAwesomeIcon icon={faVolumeHigh} aria-hidden="true" /> Ställ in volym</button>
          </div>
          {selectedDevice?.supports_volume === false && <p className="dashboard-live-message">Spotify stöder inte fjärrstyrning av volymen på den här enheten. Ändra volymen direkt på enheten.</p>}
        </div>
      )}

      {!loading && !error && devices.length === 0 && <p className="dashboard-live-message">Inga Spotify Connect-enheter är tillgängliga. Öppna Spotify på en enhet och uppdatera.</p>}

      <div className="dashboard-control-actions-row" style={{ marginTop: 18 }}>
        <button type="button" onClick={() => void sendCommand('previous', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.skipping_prev === true}><FontAwesomeIcon icon={faBackward} aria-hidden="true" /> Föregående</button>
        {playback?.is_playing ? (
          <button type="button" onClick={() => void sendCommand('pause', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || disallowedActions.pausing === true}><FontAwesomeIcon icon={faPause} aria-hidden="true" /> Pausa</button>
        ) : (
          <button type="button" onClick={() => void sendCommand('resume', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.resuming === true}><FontAwesomeIcon icon={faPlay} aria-hidden="true" /> Återuppta</button>
        )}
        <button type="button" onClick={() => void sendCommand('next', playbackDeviceId ? { deviceId: playbackDeviceId } : {})} disabled={controlsDisabled || !playback || disallowedActions.skipping_next === true}><FontAwesomeIcon icon={faForward} aria-hidden="true" /> Nästa</button>
      </div>
      <div className="dashboard-control-actions-row" style={{ marginTop: 10, gridTemplateColumns: '1fr' }}>
        <a href="/api/spotify/auth/start" className="dashboard-control-lock" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minHeight: 42, padding: '0 12px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, color: '#c5cad4', background: 'transparent', font: 'inherit', textDecoration: 'none' }}><FontAwesomeIcon icon={faMusic} aria-hidden="true" /> Anslut eller auktorisera Spotify igen</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button type="button" onClick={() => void testProfile()} disabled={profileBusy}>
          {profileBusy ? 'Testar…' : 'Testa profilen'}
        </button>
        <p className="dashboard-control-message" role="status" aria-live="polite" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {profileResult || 'Profiltestet för Spotify har inte körts.'}
        </p>
      </div>
      <p className="dashboard-control-message" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
