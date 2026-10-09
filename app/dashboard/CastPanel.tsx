'use client'

import { useCallback, useEffect, useState } from 'react'
import { AutoFetchSwitch, useAutoFetch } from './useAutoFetch'

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
        const detail = typeof result === 'object' && result !== null && 'error' in result
          ? (result as { error?: unknown }).error
          : null
        throw new Error(typeof detail === 'string' ? detail : 'Cast devices are unavailable')
      }
      const list = typeof result === 'object' && result !== null && 'devices' in result
        ? (result as { devices?: unknown }).devices
        : null
      if (!Array.isArray(list) || !list.every(isCastDevice)) {
        throw new Error('Cast bridge returned an invalid device list')
      }
      setDevices(list)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cast devices are unavailable')
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
        const result = await response.json().catch(() => null)
        const detail = typeof result === 'object' && result !== null && 'error' in result
          ? (result as { error?: unknown }).error
          : null
        setMessage(typeof detail === 'string' ? detail : `Could not send ${command} to ${device.name}.`)
      } else {
        setMessage(command === 'volume' ? `Volume updated for ${device.name}.` : `${command[0].toUpperCase()}${command.slice(1)} sent to ${device.name}.`)
      }
    } catch {
      setMessage(`Could not reach the Cast bridge for ${device.name}.`)
    } finally {
      setBusyDevice(null)
    }
  }

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="cast-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true">♫</span>
        <div>
          <p className="dashboard-eyebrow">Now playing</p>
          <h2 id="cast-heading">Cast speakers</h2>
        </div>
        <AutoFetchSwitch label="Cast speakers" {...autoFetch} onChange={autoFetch.setEnabled} />
        <button
          className="dashboard-control-lock"
          type="button"
          onClick={() => void loadDevices()}
          disabled={loading}
          aria-label="Refresh Cast speakers"
          style={{ marginLeft: 'auto', minHeight: 40, padding: '0 12px', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, color: '#c5cad4', background: 'transparent', font: 'inherit', fontSize: 12, cursor: 'pointer' }}
        >Refresh</button>
      </div>

      {loading ? (
        <p className="dashboard-live-message" role="status">Looking for Cast speakers…</p>
      ) : autoFetch.ready && !autoFetch.enabled && devices.length === 0 && !error ? (
        <p className="dashboard-live-message" role="status">Automatic updates are off. Refresh to find Cast speakers.</p>
      ) : error ? (
        <p className="dashboard-live-message is-error" role="status">{error}. Check that the local Cast bridge is running.</p>
      ) : devices.length === 0 ? (
        <p className="dashboard-live-message" role="status">No Cast speakers found. Devices appear here when they are available on the home network.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          {devices.map((device) => (
            <article key={device.id} style={{ display: 'grid', gap: 10, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.name}</strong>
                <span className="dashboard-live-label">{[device.model, device.type].filter(Boolean).join(' · ') || 'Cast speaker'}</span>
              </div>
              <div className="dashboard-control-actions-row">
                {(['play', 'pause', 'stop'] as const).map((command) => (
                  <button key={command} type="button" onClick={() => void sendCommand(device, command)} disabled={busyDevice !== null}>
                    {busyDevice === device.id ? 'Sending…' : command[0].toUpperCase() + command.slice(1)}
                  </button>
                ))}
              </div>
              <label className="dashboard-live-label" htmlFor={`cast-volume-${device.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <span>Volume</span><span>{volume}%</span>
                <input id={`cast-volume-${device.id}`} type="range" min="0" max="100" step="1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={busyDevice !== null} aria-label={`Volume for ${device.name}`} style={{ gridColumn: '1 / -1', width: '100%', accentColor: '#f4bd84' }} />
              </label>
              <div className="dashboard-control-actions-row" style={{ gridTemplateColumns: '1fr' }}>
                <button type="button" onClick={() => void sendCommand(device, 'volume')} disabled={busyDevice !== null}>Set volume</button>
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
