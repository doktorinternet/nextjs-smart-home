'use client'

import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMusic } from '@fortawesome/free-solid-svg-icons'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'
import { copy, formatCopy } from '@/app/copy'

type CastDevice = {
  id: string
  name: string
  model: string | null
  type: string | null
}

function isCastDevice(value: unknown): value is CastDevice {
  if (typeof value !== 'object' || value === null) return false
  const device = value as Record<string, unknown>
  return typeof device.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device.id)
    && typeof device.name === 'string'
    && (typeof device.model === 'string' || device.model === null)
    && (typeof device.type === 'string' || device.type === null)
}

export default function CastPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.cast');
  const [devices, setDevices] = useState<CastDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyDevice, setBusyDevice] = useState<string | null>(null)
  const [volume, setVolume] = useState(35)
  const [message, setMessage] = useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cast/devices', { cache: 'no-store' })
      const result: unknown = await response.json()
      if (!response.ok) {
        throw new Error(copy.cast.loadUnavailable)
      }
      const list = typeof result === 'object' && result !== null && 'devices' in result
        ? (result as { devices?: unknown }).devices
        : null
      if (!Array.isArray(list) || !list.every(isCastDevice)) {
        throw new Error(copy.cast.invalidDevices)
      }
      setDevices(list)
      setError(null)
    } catch (reason) {
      setError(copy.cast.loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return
    void loadDevices()
    const interval = window.setInterval(loadDevices, 15_000)
    return () => window.clearInterval(interval)
  }, [autoFetch.ready, autoFetch.enabled, loadDevices])

  async function sendCommand(device: CastDevice, command: 'play' | 'pause' | 'stop' | 'volume') {
    if (busyDevice) return
    setBusyDevice(device.id)
    setMessage(null)
    const payload = command === 'volume' ? { command, level: volume / 100 } : { command }
    try {
      const response = await fetch(`/api/cast/devices/${encodeURIComponent(device.id)}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        setMessage(formatCopy(copy.cast.commandFailed, { device: device.name }))
      } else {
        const commandMessages = {
          play: copy.cast.started,
          pause: copy.cast.paused,
          stop: copy.cast.stopped,
          volume: copy.cast.volumeUpdated,
        }
        setMessage(formatCopy(copy.cast.commandSent, { message: commandMessages[command], device: device.name }))
      }
    } catch {
      setMessage(formatCopy(copy.cast.reachedError, { device: device.name }))
    } finally {
      setBusyDevice(null)
    }
  }

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="cast-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faMusic} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.cast.eyebrow}</p>
          <h2 id="cast-heading">{copy.cast.title}</h2>
        </div>
        <AutoRefreshControl
          label={copy.cast.title}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void loadDevices()}
          refreshLabel={copy.cast.refresh}
          refreshing={loading}
        />
      </div>

      {loading ? (
        <p className="dashboard-live-message" role="status">{copy.cast.searching}</p>
      ) : autoFetch.ready && !autoFetch.enabled && devices.length === 0 && !error ? (
        null
      ) : error ? (
        <p className="dashboard-live-message is-error" role="status">{error} {copy.cast.bridgeHelp}</p>
      ) : devices.length === 0 ? (
        <p className="dashboard-live-message" role="status">{copy.cast.empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          {devices.map((device) => (
            <article key={device.id} style={{ display: 'grid', gap: 10, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.name}</strong>
                <span className="dashboard-live-label">{[device.model, device.type].filter(Boolean).join(' · ') || copy.cast.title}</span>
              </div>
              <div className="dashboard-control-actions-row">
                {(['play', 'pause', 'stop'] as const).map((command) => (
                  <button key={command} type="button" onClick={() => void sendCommand(device, command)} disabled={busyDevice !== null}>
                    {busyDevice === device.id ? copy.cast.sending : copy.cast.commands[command]}
                  </button>
                ))}
              </div>
              <label className="dashboard-live-label" htmlFor={`cast-volume-${device.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <span>{copy.cast.volume}</span><span>{volume}%</span>
                <input id={`cast-volume-${device.id}`} type="range" min="0" max="100" step="1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={busyDevice !== null} aria-label={formatCopy(copy.cast.volumeFor, { device: device.name })} style={{ gridColumn: '1 / -1', width: '100%', accentColor: '#f4bd84' }} />
              </label>
              <div className="dashboard-control-actions-row" style={{ gridTemplateColumns: '1fr' }}>
                <button type="button" onClick={() => void sendCommand(device, 'volume')} disabled={busyDevice !== null}>{copy.cast.setVolume}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="dashboard-control-message" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
