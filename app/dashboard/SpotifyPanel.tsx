'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpotify } from '@fortawesome/free-brands-svg-icons'
import {
  faBackward,
  faBookOpen,
  faHeadphonesAlt,
  faMobileScreenButton,
  faMusic,
  faPause,
  faPlay,
  faRepeat,
  faShuffle,
  faTv,
  faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import Image from 'next/image'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'
import { copy } from '@/app/copy'

type SpotifyDevice = {
  id: string
  name: string
  type: string
  is_active?: boolean
  is_restricted?: boolean
  volume_percent?: number | null
  supports_volume?: boolean
}

type SpotifyImage = { url: string }
type SpotifyPlaylist = {
  id: string
  uri: string
  name: string
  images: SpotifyImage[]
  externalUrl: string
  totalTracks: number | null
}
type SpotifyEpisode = {
  id: string
  uri: string
  name: string
  images: SpotifyImage[]
  externalUrl: string
  showName: string
  durationMs: number
  playable: boolean
}
type SpotifyAudiobook = {
  id: string
  uri: string
  name: string
  images: SpotifyImage[]
  externalUrl: string
  authors: string
}
type SpotifyCurrentItem = {
  name: string
  type: string
  uri?: string
  duration_ms?: number
  artists?: Array<{ name: string }>
  album?: { images?: SpotifyImage[] }
  images?: SpotifyImage[]
  show?: { name?: string }
}
type SpotifyPlayback = {
  is_playing: boolean
  progress_ms: number | null
  item: SpotifyCurrentItem | null
  device: SpotifyDevice | null
  shuffle_state?: boolean
  repeat_state?: 'off' | 'context' | 'track'
  actions?: { disallows?: Record<string, boolean> }
}
type LibraryKind = 'playlists' | 'spoken'
type CommandPath = 'pause' | 'resume' | 'previous' | 'next' | 'transfer' | 'volume' | 'shuffle' | 'repeat' | 'seek' | 'play'
type PlaylistPage = { items: SpotifyPlaylist[] }
type SpokenPage = { episodes: SpotifyEpisode[]; audiobooks: SpotifyAudiobook[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function imagesFrom(value: unknown): SpotifyImage[] {
  if (!Array.isArray(value)) return []
  return value.filter((image): image is SpotifyImage =>
    isRecord(image) && typeof image.url === 'string' && image.url.startsWith('https://'))
}

function spotifyUrl(value: unknown, fallback: string): string {
  if (isRecord(value) && isRecord(value.external_urls) &&
    typeof value.external_urls.spotify === 'string' &&
    value.external_urls.spotify.startsWith('https://open.spotify.com/')) {
    return value.external_urls.spotify
  }
  return fallback
}

function isDevice(value: unknown): value is SpotifyDevice {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && typeof value.type === 'string' &&
    (value.is_active === undefined || typeof value.is_active === 'boolean') &&
    (value.is_restricted === undefined || typeof value.is_restricted === 'boolean') &&
    (value.supports_volume === undefined || typeof value.supports_volume === 'boolean') &&
    (value.volume_percent === undefined || value.volume_percent === null ||
      (typeof value.volume_percent === 'number' && Number.isInteger(value.volume_percent) &&
        value.volume_percent >= 0 && value.volume_percent <= 100))
}

function isCurrentItem(value: unknown): value is SpotifyCurrentItem {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.type !== 'string') return false
  if (value.duration_ms !== undefined &&
    (typeof value.duration_ms !== 'number' || !Number.isFinite(value.duration_ms) || value.duration_ms < 0)) return false
  if (value.artists !== undefined && (!Array.isArray(value.artists) ||
    !value.artists.every((artist) => isRecord(artist) && typeof artist.name === 'string'))) return false
  if (value.album !== undefined && (!isRecord(value.album) ||
    (value.album.images !== undefined && !Array.isArray(value.album.images)))) return false
  if (value.show !== undefined && (!isRecord(value.show) ||
    (value.show.name !== undefined && typeof value.show.name !== 'string'))) return false
  return true
}

function isPlayback(value: unknown): value is SpotifyPlayback {
  if (!isRecord(value) || typeof value.is_playing !== 'boolean') return false
  if (value.progress_ms !== null &&
    (typeof value.progress_ms !== 'number' || !Number.isFinite(value.progress_ms) || value.progress_ms < 0)) return false
  if (value.item !== null && !isCurrentItem(value.item)) return false
  if (value.device !== null && !isDevice(value.device)) return false
  if (value.shuffle_state !== undefined && typeof value.shuffle_state !== 'boolean') return false
  if (value.repeat_state !== undefined &&
    value.repeat_state !== 'off' && value.repeat_state !== 'context' && value.repeat_state !== 'track') return false
  if (value.actions !== undefined) {
    if (!isRecord(value.actions)) return false
    const disallows = value.actions.disallows
    if (disallows !== undefined && (!isRecord(disallows) ||
      !Object.values(disallows).every((allowed) => typeof allowed === 'boolean'))) return false
  }
  return true
}

function parsePlaylist(value: unknown): SpotifyPlaylist | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.uri !== 'string' ||
    !value.uri.startsWith('spotify:playlist:') || typeof value.name !== 'string') return null
  const total = isRecord(value.items) && typeof value.items.total === 'number' ? value.items.total : null
  return {
    id: value.id,
    uri: value.uri,
    name: value.name,
    images: imagesFrom(value.images),
    externalUrl: spotifyUrl(value, 'https://open.spotify.com/playlist/' + encodeURIComponent(value.id)),
    totalTracks: total,
  }
}

function parseEpisode(value: unknown): SpotifyEpisode | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.uri !== 'string' ||
    !value.uri.startsWith('spotify:episode:') || typeof value.name !== 'string' ||
    typeof value.duration_ms !== 'number') return null
  const show = isRecord(value.show) ? value.show : null
  return {
    id: value.id,
    uri: value.uri,
    name: value.name,
    images: imagesFrom(value.images).length > 0
      ? imagesFrom(value.images)
      : imagesFrom(show?.images),
    externalUrl: spotifyUrl(value, 'https://open.spotify.com/episode/' + encodeURIComponent(value.id)),
    showName: typeof show?.name === 'string' ? show.name : copy.spotify.podcasts,
    durationMs: value.duration_ms,
    playable: value.is_playable !== false,
  }
}

function parseAudiobook(value: unknown): SpotifyAudiobook | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.uri !== 'string' ||
    !value.uri.startsWith('spotify:audiobook:') || typeof value.name !== 'string') return null
  const authors = Array.isArray(value.authors)
    ? value.authors.filter((author) => isRecord(author) && typeof author.name === 'string')
      .map((author) => (author as { name: string }).name).join(', ')
    : ''
  return {
    id: value.id,
    uri: value.uri,
    name: value.name,
    images: imagesFrom(value.images),
    externalUrl: spotifyUrl(value, 'https://open.spotify.com/audiobook/' + encodeURIComponent(value.id)),
    authors,
  }
}

function durationLabel(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) return '0:00'
  const seconds = Math.floor(milliseconds / 1000)
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

function deviceIcon(device: SpotifyDevice | null): IconDefinition {
  const type = device?.type.toLowerCase() ?? ''
  if (type.includes('phone') || type.includes('mobile')) return faMobileScreenButton
  if (type.includes('tv')) return faTv
  if (type.includes('speaker') || type.includes('cast')) return faVolumeHigh
  return faHeadphonesAlt
}

function CoverCard({
  href,
  onClick,
  disabled,
  image,
  title,
  subtitle,
  children,
}: {
  href?: string
  onClick?: () => void
  disabled?: boolean
  image?: string
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <article className="spotify-content-card">
      {onClick ? (
        <button className="spotify-content-link spotify-playlist-action" type="button" onClick={onClick} disabled={disabled}>
          {image ? <Image className="spotify-content-art" src={image} alt="" width={640} height={640} sizes="(max-width: 560px) 112px, 132px" /> : (
            <span className="spotify-content-placeholder" aria-hidden="true"><FontAwesomeIcon icon={faMusic} /></span>
          )}
          <span className="spotify-content-title">{title}</span>
          <span className="spotify-content-subtitle">{subtitle}</span>
        </button>
      ) : (
        <a className="spotify-content-link" href={href} target="_blank" rel="noreferrer">
          {image ? <Image className="spotify-content-art" src={image} alt="" width={640} height={640} sizes="(max-width: 560px) 112px, 132px" /> : (
            <span className="spotify-content-placeholder" aria-hidden="true"><FontAwesomeIcon icon={faMusic} /></span>
          )}
          <span className="spotify-content-title">{title}</span>
          <span className="spotify-content-subtitle">{subtitle}</span>
        </a>
      )}
      {children}
    </article>
  )
}

export default function SpotifyPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.spotify')
  const [playback, setPlayback] = useState<SpotifyPlayback | null>(null)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [devicePickerExpanded, setDevicePickerExpanded] = useState(false)
  const [volume, setVolume] = useState(50)
  const [positionMs, setPositionMs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [libraryKind, setLibraryKind] = useState<LibraryKind>('playlists')
  const [library, setLibrary] = useState<PlaylistPage & SpokenPage>({
    items: [],
    episodes: [],
    audiobooks: [],
  })
  const [loadedLibrary, setLoadedLibrary] = useState<Set<LibraryKind>>(new Set())
  const [libraryLoading, setLibraryLoading] = useState<LibraryKind | null>(null)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [spokenAvailability, setSpokenAvailability] = useState({ episodes: true, audiobooks: true })
  const volumeTimer = useRef<number | null>(null)
  const libraryCache = useRef(new Set<LibraryKind>())

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
      const activeId = playbackResult?.device?.id || deviceList.find((device) => device.is_active)?.id
      setPlayback(playbackResult)
      setDevices(deviceList)
      setSelectedDeviceId((current) => activeId || current || deviceList[0]?.id || '')
      const activeDevice = deviceList.find((device) => device.id === (activeId || selectedDeviceId))
      if (activeDevice?.volume_percent != null) setVolume(activeDevice.volume_percent)
      setError(null)
    } catch {
      setError(copy.spotify.unavailable)
    } finally {
      setLoading(false)
    }
  }, [selectedDeviceId])

  const loadLibrary = useCallback(async (kind: LibraryKind, force = false) => {
    if (!force && libraryCache.current.has(kind)) return
    setLibraryLoading(kind)
    setLibraryError(null)
    try {
      const response = await fetch('/api/spotify/library?kind=' + kind, { cache: 'no-store' })
      const result: unknown = await response.json()
      if (!response.ok) {
        if (response.status === 403) throw new Error(copy.spotify.libraryPermission)
        throw new Error(copy.spotify.libraryUnavailable)
      }
      if (kind === 'playlists') {
        const values = isRecord(result) && Array.isArray(result.items) ? result.items : []
        const items = values.map(parsePlaylist).filter((item): item is SpotifyPlaylist => item !== null)
        setLibrary((current) => ({ ...current, items }))
      } else {
        const episodeResult = isRecord(result) && isRecord(result.episodes) ? result.episodes : null
        const audiobookResult = isRecord(result) && isRecord(result.audiobooks) ? result.audiobooks : null
        const episodeValues = episodeResult && Array.isArray(episodeResult.items) ? episodeResult.items : []
        const audiobookValues = audiobookResult && Array.isArray(audiobookResult.items) ? audiobookResult.items : []
        const episodes = episodeValues.map((saved) => parseEpisode(isRecord(saved) ? saved.episode : null))
          .filter((item): item is SpotifyEpisode => item !== null)
        const audiobooks = audiobookValues.map(parseAudiobook).filter((item): item is SpotifyAudiobook => item !== null)
        setLibrary((current) => ({ ...current, episodes, audiobooks }))
        setSpokenAvailability({
          episodes: episodeResult?.available !== false,
          audiobooks: audiobookResult?.available !== false,
        })
      }
      libraryCache.current.add(kind)
      setLoadedLibrary((current) => new Set(current).add(kind))
    } catch (reason) {
      setLibraryError(reason instanceof Error ? reason.message : copy.spotify.libraryUnavailable)
    } finally {
      setLibraryLoading(null)
    }
  }, [])

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return
    void refresh()
    const interval = window.setInterval(() => void refresh(), 15_000)
    return () => window.clearInterval(interval)
  }, [autoFetch.ready, autoFetch.enabled, refresh, refreshToken])

  useEffect(() => {
    if (autoFetch.ready && autoFetch.enabled) void loadLibrary(libraryKind)
  }, [autoFetch.ready, autoFetch.enabled, libraryKind, loadLibrary])

  useEffect(() => () => {
    if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current)
  }, [])

  useEffect(() => {
    setPositionMs(playback?.progress_ms ?? 0)
  }, [playback?.progress_ms, playback?.item?.uri])

  useEffect(() => {
    const duration = playback?.item?.duration_ms
    if (!playback?.is_playing || !duration) return
    const interval = window.setInterval(() => {
      setPositionMs((current) => Math.min(current + 1000, duration))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [playback?.is_playing, playback?.item?.duration_ms])

  async function sendCommand(path: CommandPath, payload: Record<string, unknown>, successMessage?: string): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/spotify/player/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        setMessage(response.status === 403 ? copy.spotify.premiumRequired : copy.spotify.commandFailed)
        return false
      }
      setMessage(successMessage ?? copy.spotify.commandSent)
      window.setTimeout(() => setRefreshToken((value) => value + 1), 350)
      return true
    } catch {
      setMessage(copy.spotify.unreachable)
      return false
    } finally {
      setBusy(false)
    }
  }

  function updateVolume(value: number) {
    setVolume(value)
    if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current)
    volumeTimer.current = window.setTimeout(() => {
      void sendCommand('volume', { deviceId: selectedDeviceId, volumePercent: value }, copy.spotify.volumeUpdated)
    }, 220)
  }

  function playPlaylist(playlist: SpotifyPlaylist) {
    void sendCommand('play', { deviceId: selectedDeviceId, contextUri: playlist.uri }, copy.spotify.playContent)
  }

  function playEpisode(episode: SpotifyEpisode) {
    void sendCommand('play', { deviceId: selectedDeviceId, uri: episode.uri }, copy.spotify.playContent)
  }

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null
  const track = playback?.item ?? null
  const albumImage = track?.album?.images?.[0]?.url ?? track?.images?.[0]?.url
  const artistNames = track?.artists?.map((artist) => artist.name).join(', ') ||
    (track?.type === 'episode' ? track.show?.name : undefined)
  const duration = track?.duration_ms ?? 0
  const controlsDisabled = busy || loading
  const volumeDisabled = controlsDisabled || !selectedDeviceId || selectedDevice?.supports_volume === false
  const disallowed = playback?.actions?.disallows ?? {}
  const playbackDeviceId = playback?.device?.id || selectedDeviceId
  const repeatState = playback?.repeat_state ?? 'off'
  const repeatNext = repeatState === 'off' ? 'context' : repeatState === 'context' ? 'track' : 'off'

  function commitSeek() {
    if (!playbackDeviceId || !track || disallowed.seeking === true) return
    void sendCommand('seek', { deviceId: playbackDeviceId, positionMs }, copy.spotify.seeking)
  }

  function renderPlaylist(playlist: SpotifyPlaylist) {
    return (
      <CoverCard
        key={playlist.id}
        onClick={() => playPlaylist(playlist)}
        disabled={controlsDisabled || !selectedDeviceId}
        image={playlist.images[0]?.url}
        title={playlist.name}
        subtitle={playlist.totalTracks === null ? copy.spotify.playlists : String(playlist.totalTracks) + ' spår'}
      />
    )
  }

  function renderEpisode(episode: SpotifyEpisode) {
    return (
      <CoverCard
        key={episode.id}
        href={episode.externalUrl}
        image={episode.images[0]?.url}
        title={episode.name}
        subtitle={episode.showName}
      >
        <button className="spotify-card-play" type="button" onClick={() => playEpisode(episode)} disabled={controlsDisabled || !selectedDeviceId || !episode.playable}>
          <FontAwesomeIcon icon={faPlay} aria-hidden="true" /> {copy.spotify.playContent}
        </button>
      </CoverCard>
    )
  }

  return (
    <section className="dashboard-module dashboard-live-card spotify-panel" aria-labelledby="spotify-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon spotify-heading-icon" aria-hidden="true"><FontAwesomeIcon icon={faSpotify} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.spotify.eyebrow}</p>
          <h2 id="spotify-heading">{copy.spotify.title}</h2>
        </div>
        <AutoRefreshControl
          label={copy.spotify.title}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => {
            void refresh()
            void loadLibrary(libraryKind, true)
          }}
          refreshLabel={copy.spotify.refresh}
          refreshing={loading || libraryLoading !== null}
        />
      </div>

      <div className="spotify-player">
      <div className={'spotify-now-playing' + (devicePickerExpanded ? ' is-device-expanded' : '')}>
        {albumImage
          ? <Image className="spotify-current-art" src={albumImage} alt="" width={640} height={640} sizes="(max-width: 560px) 68px, 96px" />
          : <div className="spotify-current-art spotify-current-art-empty" aria-hidden="true"><FontAwesomeIcon icon={faMusic} /></div>}
        <div className="spotify-current-info" aria-live="polite">
          <h3>{track?.name ?? copy.spotify.nothingPlaying}</h3>
          <p>{artistNames || (track?.type === 'episode' ? copy.spotify.episode : copy.spotify.title)}</p>
          {track && (
            <div className="spotify-progress">
              <span>{durationLabel(positionMs)}</span>
              <input
                type="range"
                min="0"
                max={Math.max(duration, 1)}
                value={Math.min(positionMs, duration || 0)}
                onChange={(event) => setPositionMs(Number(event.target.value))}
                onPointerUp={commitSeek}
                onKeyUp={commitSeek}
                disabled={controlsDisabled || duration <= 0 || !playbackDeviceId || disallowed.seeking === true}
                aria-label={copy.spotify.progress}
              />
              <span>{durationLabel(duration)}</span>
            </div>
          )}
        </div>
        <div className="spotify-device-switcher">
          <button
            className="spotify-device-summary"
            type="button"
            onClick={() => setDevicePickerExpanded((expanded) => !expanded)}
            aria-expanded={devicePickerExpanded}
            aria-controls="spotify-device-list"
            disabled={devices.length === 0}
          >
            <FontAwesomeIcon icon={deviceIcon(selectedDevice)} aria-hidden="true" />
            <span><strong>{selectedDevice?.name ?? copy.spotify.chooseDevice}</strong><small>{selectedDevice?.id === playback?.device?.id ? copy.spotify.active : copy.spotify.switchDevice}</small></span>
            <span className="spotify-chevron" aria-hidden="true">⌄</span>
          </button>
          {devicePickerExpanded && devices.length > 0 && (
            <div className="spotify-device-picker" id="spotify-device-list">
              <p className="spotify-section-label">{copy.spotify.chooseDevice}</p>
              <div className="spotify-device-grid">
                {devices.map((device) => {
                  const active = device.id === playback?.device?.id
                  return (
                    <button
                      className={'spotify-device-tile' + (active ? ' is-active' : '')}
                      type="button"
                      key={device.id}
                      onClick={() => {
                        setSelectedDeviceId(device.id)
                        if (device.volume_percent != null) setVolume(device.volume_percent)
                        if (!active) void sendCommand('transfer', { deviceId: device.id, play: Boolean(playback?.is_playing) }, copy.spotify.commandMessages.transfer)
                      }}
                      disabled={controlsDisabled || device.is_restricted === true}
                      aria-pressed={active}
                    >
                      <FontAwesomeIcon icon={deviceIcon(device)} aria-hidden="true" />
                      <span>{device.name}</span>
                      <small>{active ? copy.spotify.active : device.type}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="spotify-playback-controls" role="group" aria-label={copy.spotify.title}>
        <button
          className={'spotify-secondary-control' + (playback?.shuffle_state ? ' is-active' : '')}
          type="button"
          onClick={() => void sendCommand('shuffle', { deviceId: playbackDeviceId, state: !playback?.shuffle_state }, playback?.shuffle_state ? copy.spotify.shuffleDisabled : copy.spotify.shuffleEnabled)}
          disabled={controlsDisabled || !playbackDeviceId || disallowed.toggling_shuffle === true}
          aria-label={copy.spotify.shuffle}
          aria-pressed={Boolean(playback?.shuffle_state)}
        ><FontAwesomeIcon icon={faShuffle} aria-hidden="true" /></button>
        <button
          className="spotify-secondary-control"
          type="button"
          onClick={() => void sendCommand('previous', playbackDeviceId ? { deviceId: playbackDeviceId } : {})}
          disabled={controlsDisabled || !playback || disallowed.skipping_prev === true}
          aria-label={copy.spotify.previous}
        ><FontAwesomeIcon icon={faBackward} aria-hidden="true" /></button>
        <button
          className="spotify-primary-control"
          type="button"
          onClick={() => void sendCommand(playback?.is_playing ? 'pause' : 'resume', playbackDeviceId ? { deviceId: playbackDeviceId } : {})}
          disabled={controlsDisabled || !playback || disallowed[playback?.is_playing ? 'pausing' : 'resuming'] === true}
          aria-label={playback?.is_playing ? copy.spotify.pause : copy.spotify.resume}
        ><FontAwesomeIcon icon={playback?.is_playing ? faPause : faPlay} aria-hidden="true" /></button>
        <button
          className="spotify-secondary-control"
          type="button"
          onClick={() => void sendCommand('next', playbackDeviceId ? { deviceId: playbackDeviceId } : {})}
          disabled={controlsDisabled || !playback || disallowed.skipping_next === true}
          aria-label={copy.spotify.next}
        ><FontAwesomeIcon icon={faBackward} className="spotify-next-icon" aria-hidden="true" /></button>
        <button
          className={'spotify-secondary-control' + (repeatState !== 'off' ? ' is-active' : '')}
          type="button"
          onClick={() => void sendCommand('repeat', { deviceId: playbackDeviceId, state: repeatNext }, copy.spotify.repeatUpdated)}
          disabled={controlsDisabled || !playbackDeviceId || disallowed.toggling_repeat_track === true}
          aria-label={repeatState === 'off' ? copy.spotify.repeatOff : repeatState === 'context' ? copy.spotify.repeatContext : copy.spotify.repeatTrack}
          aria-pressed={repeatState !== 'off'}
        ><FontAwesomeIcon icon={faRepeat} aria-hidden="true" />{repeatState === 'track' && <span className="spotify-repeat-one">1</span>}</button>
      </div>

      {selectedDevice && (
        <label className="spotify-volume-row">
          <FontAwesomeIcon icon={faVolumeHigh} aria-hidden="true" />
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(event) => updateVolume(Number(event.target.value))}
            disabled={volumeDisabled}
            aria-label={copy.spotify.volumeAria}
          />
          <span>{volume}%</span>
        </label>
      )}
      {selectedDevice?.supports_volume === false && <p className="spotify-hint">{copy.spotify.volumeUnsupported}</p>}

      {!error && !track && playback?.is_playing && (
        <p className="spotify-hint">{copy.spotify.activeWithoutTrack}</p>
      )}
      </div>

      <div className="dashboard-panel-content spotify-panel-content">
      {error && <p className="dashboard-live-message is-error" role="status">{error}</p>}

      <section className="spotify-library" aria-label={copy.spotify.title}>
        <div className="spotify-library-tabs" role="tablist" aria-label={copy.spotify.title}>
          <button
            className={!devicePickerExpanded && libraryKind === 'playlists' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={!devicePickerExpanded && libraryKind === 'playlists'}
            onClick={() => {
              setDevicePickerExpanded(false)
              setLibraryKind('playlists')
            }}
          ><FontAwesomeIcon icon={faMusic} aria-hidden="true" />{copy.spotify.playlists}</button>
          <button
            className={!devicePickerExpanded && libraryKind === 'spoken' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={!devicePickerExpanded && libraryKind === 'spoken'}
            onClick={() => {
              setDevicePickerExpanded(false)
              setLibraryKind('spoken')
            }}
          ><FontAwesomeIcon icon={faBookOpen} aria-hidden="true" />{copy.spotify.spoken}</button>
        </div>

        {!devicePickerExpanded && <>
        {libraryError && <p className="spotify-hint" role="status">{libraryError}</p>}

        {!libraryError && libraryKind === 'playlists' && loadedLibrary.has('playlists') && (
          library.items.length > 0
            ? <div className="spotify-content-row">{library.items.map(renderPlaylist)}</div>
            : <p className="spotify-hint">{copy.spotify.noPlaylists}</p>
        )}

        {!libraryError && libraryKind === 'spoken' && loadedLibrary.has('spoken') && (
          <div className="spotify-spoken-content">
            {spokenAvailability.episodes && library.episodes.length > 0 && (
              <>
                <h3 className="spotify-section-label">{copy.spotify.podcasts}</h3>
                <div className="spotify-content-row">{library.episodes.map(renderEpisode)}</div>
              </>
            )}
            {spokenAvailability.audiobooks && library.audiobooks.length > 0 && (
              <>
                <h3 className="spotify-section-label">{copy.spotify.audiobooks}</h3>
                <div className="spotify-content-row">
                  {library.audiobooks.map((book) => (
                    <CoverCard key={book.id} href={book.externalUrl} image={book.images[0]?.url} title={book.name} subtitle={book.authors || copy.spotify.audiobooks}>
                      <a className="spotify-card-play" href={book.externalUrl} target="_blank" rel="noreferrer">{copy.spotify.openSpotify}</a>
                    </CoverCard>
                  ))}
                </div>
                <p className="spotify-hint">{copy.spotify.audiobookOpenOnly}</p>
              </>
            )}
            {!spokenAvailability.episodes && !spokenAvailability.audiobooks &&
              <p className="spotify-hint">{copy.spotify.libraryPermission}</p>}
            {spokenAvailability.episodes && library.episodes.length === 0 &&
              <p className="spotify-hint">{copy.spotify.noEpisodes}</p>}
            {spokenAvailability.audiobooks && library.audiobooks.length === 0 &&
              <p className="spotify-hint">{copy.spotify.noAudiobooks}</p>}
          </div>
        )}
        </>}
      </section>

      <p className="spotify-status" role="status" aria-live="polite">{message}</p>
      </div>
    </section>
  )
}
