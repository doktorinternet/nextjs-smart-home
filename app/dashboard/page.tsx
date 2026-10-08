'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import CustomTimeTable from '@/app/components/TimeTable/CustomTimeTable'
import CastPanel from './CastPanel'
import SpotifyPanel from './SpotifyPanel'
import ElectroluxPanel from './ElectroluxPanel'
import { AutoFetchSwitch, useAutoFetch } from './useAutoFetch'

type PrinterStatus = {
  connection?: { state?: string }
  job?: {
    state?: string
    details?: { file?: { name?: string; display?: string } | null } | null
    progress?: { completion?: number | null; printTimeLeft?: number | null } | null
  }
}

type SpeedSample = {
  timestamp: string
  runStatus: 'Completed' | 'Failed'
  downloadMbps: number | null
  uploadMbps: number | null
}

type SpeedHistory = { status?: string; error?: string; results?: SpeedSample[] }

function displayDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

function formatSpeed(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} Mbps`
}

function PrinterCard({ unlocked, onUnlockedChange }: { unlocked: boolean; onUnlockedChange: (unlocked: boolean) => void }) {
  const autoFetch = useAutoFetch('dashboard.autoFetch.printer')
  const [printer, setPrinter] = useState<PrinterStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [controlBusy, setControlBusy] = useState(false)
  const [controlMessage, setControlMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/printer/status', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Printer status is unavailable')
      setPrinter(result)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Printer status is unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return
    void load()
    const interval = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(interval)
  }, [autoFetch.ready, autoFetch.enabled, load])

  const connection = printer?.connection?.state ?? 'Unknown'
  const job = printer?.job
  const jobState = job?.state ?? 'Unknown'
  const progress = job?.progress?.completion
  const hasProgress = typeof progress === 'number' && Number.isFinite(progress)
  const fileName = job?.details?.file?.display || job?.details?.file?.name
  const disconnected = connection.toLowerCase() === 'closed' || connection.toLowerCase() === 'offline'
  const remaining = displayDuration(job?.progress?.printTimeLeft)
  const canPause = !disconnected && jobState === 'Printing'
  const canResume = !disconnected && jobState === 'Paused'
  const canCancel = canPause || canResume

  async function unlockControls(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (controlBusy || !pin) return
    setControlBusy(true)
    setControlMessage(null)
    try {
      const response = await fetch('/api/control-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      setPin('')
      if (!response.ok) {
        setControlMessage(response.status === 401 ? 'That PIN was not accepted.' : 'Controls could not be unlocked. Try again later.')
        return
      }
      onUnlockedChange(true)
      setControlMessage('Printer controls unlocked.')
    } catch {
      setPin('')
      setControlMessage('Controls could not be unlocked. Check your connection and try again.')
    } finally {
      setControlBusy(false)
    }
  }

  async function runPrinterCommand(command: 'pause' | 'resume' | 'cancel') {
    if (controlBusy) return
    if (command === 'cancel' && !window.confirm('Cancel the current print? This cannot be undone.')) return
    setControlBusy(true)
    setControlMessage(null)
    try {
      const response = await fetch('/api/printer/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      if (response.status === 401) {
        onUnlockedChange(false)
        setControlMessage('Your control session expired. Unlock controls again.')
      } else if (!response.ok) {
        setControlMessage('The printer command failed. Check the printer status and try again.')
      } else {
        setControlMessage(command === 'cancel' ? 'Cancel command sent.' : `${command === 'pause' ? 'Pause' : 'Resume'} command sent.`)
      }
    } catch {
      setControlMessage('The printer could not be reached. Check its status and try again.')
    } finally {
      setControlBusy(false)
    }
  }

  async function lockControls() {
    setControlBusy(true)
    try {
      const response = await fetch('/api/control-auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Logout failed')
      setControlMessage('Printer controls locked.')
    } catch {
      setControlMessage('Controls are hidden, but the server session may remain active for 15 minutes. Check your connection.')
    } finally {
      onUnlockedChange(false)
      setControlBusy(false)
    }
  }

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="printer-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true">▱</span>
        <div>
          <p className="dashboard-eyebrow">Workshop</p>
          <h2 id="printer-heading">3D printer</h2>
        </div>
        <AutoFetchSwitch label="printer" {...autoFetch} onChange={autoFetch.setEnabled} />
        {!loading && !error && (
          <span className={`dashboard-live-status${disconnected ? ' is-offline' : ''}`}>
            <span aria-hidden="true" />{disconnected ? 'Offline' : connection}
          </span>
        )}
      </div>

      {loading ? (
        <p className="dashboard-live-message" role="status">Loading printer status…</p>
      ) : error ? (
        <p className="dashboard-live-message is-error" role="status">{error}</p>
      ) : autoFetch.ready && !autoFetch.enabled && !printer ? (
        <p className="dashboard-live-message" role="status">Automatic updates are off. Refresh to load printer status.</p>
      ) : disconnected ? (
        <p className="dashboard-live-message">Printer is offline. Check its connection to OctoPrint.</p>
      ) : (
        <div className="dashboard-printer-content" aria-live="polite">
          <div className="dashboard-printer-job">
            <span className="dashboard-live-label">Current job</span>
            <strong>{fileName || (jobState === 'Operational' ? 'No active print' : jobState)}</strong>
            <span className="dashboard-job-state">{jobState}</span>
          </div>
          {hasProgress ? (
            <div className="dashboard-progress-wrap">
              <div className="dashboard-progress-label">
                <span>Progress</span><strong>{Math.round(progress)}%</strong>
              </div>
              <div className="dashboard-progress-track" role="progressbar" aria-label="Print progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))}>
                <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
              {remaining && <span className="dashboard-remaining">About {remaining} remaining</span>}
            </div>
          ) : (
            <p className="dashboard-printer-idle">{jobState === 'Operational' ? 'Ready for a print' : 'Progress is not available for this job.'}</p>
          )}
        </div>
      )}

      <div className="dashboard-printer-controls">
        <button className="dashboard-control-lock" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh printer status">Refresh</button>
        {!unlocked ? (
          <form className="dashboard-control-unlock" onSubmit={unlockControls}>
            <label htmlFor="printer-control-pin">Unlock printer controls</label>
            <div className="dashboard-control-unlock-row">
              <input
                id="printer-control-pin"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoComplete="off"
                aria-describedby="printer-control-message"
                disabled={controlBusy}
              />
              <button type="submit" disabled={controlBusy || !pin}>{controlBusy ? 'Unlocking…' : 'Unlock'}</button>
            </div>
          </form>
        ) : (
          <div className="dashboard-control-actions">
            <div className="dashboard-control-actions-row">
              <button type="button" onClick={() => void runPrinterCommand('pause')} disabled={controlBusy || !canPause}>Pause</button>
              <button type="button" onClick={() => void runPrinterCommand('resume')} disabled={controlBusy || !canResume}>Resume</button>
              <button className="is-danger" type="button" onClick={() => void runPrinterCommand('cancel')} disabled={controlBusy || !canCancel}>Cancel print</button>
            </div>
            <button className="dashboard-control-lock" type="button" onClick={() => void lockControls()} disabled={controlBusy}>Lock controls</button>
          </div>
        )}
        <p id="printer-control-message" className="dashboard-control-message" role="status" aria-live="polite">{controlMessage || 'Controls stay locked until you enter your PIN.'}</p>
      </div>
    </section>
  )
}

function SpeedCard() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.networkSpeed')
  const [history, setHistory] = useState<SpeedHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/speed-history?limit=30', { cache: 'no-store' })
      const result: SpeedHistory = await response.json()
      if (!response.ok || result.status !== 'available') throw new Error(result.error || 'Speed history is unavailable')
      setHistory(result)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Speed history is unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return
    void load()
    const interval = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(interval)
  }, [autoFetch.ready, autoFetch.enabled, load])

  const samples = (history?.results ?? [])
    .filter((sample) => sample.runStatus === 'Completed' && (sample.downloadMbps != null || sample.uploadMbps != null))
    .slice(0, 8)
    .reverse()
  const latest = samples[samples.length - 1]
  const values = samples.flatMap((sample) => [sample.downloadMbps, sample.uploadMbps]).filter((value): value is number => value != null)
  const max = Math.max(1, ...values)
  const chartPoints = (key: 'downloadMbps' | 'uploadMbps') => samples
    .map((sample, index) => sample[key] == null ? null : `${samples.length < 2 ? 150 : 12 + (index * 276) / (samples.length - 1)},${88 - (sample[key]! / max) * 76}`)
    .filter((point): point is string => point != null)
    .join(' ')

  return (
    <section className="dashboard-module dashboard-live-card dashboard-speed-card" aria-labelledby="speed-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true">⌁</span>
        <div>
          <p className="dashboard-eyebrow">Connection</p>
          <h2 id="speed-heading">Network speed</h2>
        </div>
        <AutoFetchSwitch label="network speed" {...autoFetch} onChange={autoFetch.setEnabled} />
        <button className="dashboard-control-lock" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh network speed history">Refresh</button>
        {latest && <span className="dashboard-speed-time">Latest test</span>}
      </div>

      {loading ? (
        <p className="dashboard-live-message" role="status">Loading speed history…</p>
      ) : error ? (
        <p className="dashboard-live-message is-error" role="status">{error}</p>
      ) : autoFetch.ready && !autoFetch.enabled && !history ? (
        <p className="dashboard-live-message" role="status">Automatic updates are off. Refresh to load speed history.</p>
      ) : !latest ? (
        <p className="dashboard-live-message">No completed speed tests are recorded yet.</p>
      ) : (
        <div className="dashboard-speed-content">
          <div className="dashboard-speed-values" aria-live="polite">
            <div><span className="dashboard-speed-dot is-download" /><span className="dashboard-live-label">Download</span><strong>{formatSpeed(latest.downloadMbps)}</strong></div>
            <div><span className="dashboard-speed-dot is-upload" /><span className="dashboard-live-label">Upload</span><strong>{formatSpeed(latest.uploadMbps)}</strong></div>
          </div>
          <div className="dashboard-speed-chart-wrap">
            <svg className="dashboard-speed-chart" viewBox="0 0 300 100" role="img" aria-label={`Recent speed history, download ${formatSpeed(latest.downloadMbps)}, upload ${formatSpeed(latest.uploadMbps)}`}>
              <line x1="8" y1="88" x2="292" y2="88" />
              {chartPoints('downloadMbps') && <polyline className="is-download" points={chartPoints('downloadMbps')} />}
              {chartPoints('uploadMbps') && <polyline className="is-upload" points={chartPoints('uploadMbps')} />}
              {samples.length === 1 && samples[0].downloadMbps != null && <circle className="is-download" cx="150" cy={88 - (samples[0].downloadMbps / max) * 76} r="3.5" />}
              {samples.length === 1 && samples[0].uploadMbps != null && <circle className="is-upload" cx="150" cy={88 - (samples[0].uploadMbps / max) * 76} r="3.5" />}
            </svg>
            <div className="dashboard-speed-chart-labels"><span>Older</span><span>Recent</span></div>
          </div>
          <p className="dashboard-speed-updated">{new Date(latest.timestamp).toLocaleString()}</p>
        </div>
      )}
    </section>
  )
}

type ModuleCardProps = {
  eyebrow: string
  title: string
  description: string
  icon: string
}

function ModuleCard({ eyebrow, title, description, icon }: ModuleCardProps) {
  return (
    <section className="dashboard-module" aria-label={title}>
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true">{icon}</span>
        <div>
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="dashboard-module-empty">
        <span className="dashboard-empty-mark" aria-hidden="true">＋</span>
        <p>{description}</p>
      </div>
    </section>
  )
}

export default function Page() {
  const [controlsUnlocked, setControlsUnlocked] = useState(false)

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">H</span>
            <div>
              <p className="dashboard-eyebrow">Home overview</p>
              <h1>Good to be home<span>.</span></h1>
            </div>
          </div>
          <div className="dashboard-header-note">
            <span>Your home, at a glance</span>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="dashboard-module dashboard-transit" aria-labelledby="transit-heading">
            <div className="dashboard-module-heading">
              <span className="dashboard-module-icon" aria-hidden="true">↗</span>
              <div>
                <p className="dashboard-eyebrow">Getting around</p>
                <h2 id="transit-heading">Tram departures</h2>
              </div>
              <span className="dashboard-source">Västtrafik</span>
            </div>
            <div className="dashboard-transit-content">
              <CustomTimeTable />
            </div>
          </section>

          <div className="dashboard-side-stack">
            <ElectroluxPanel />
            <PrinterCard unlocked={controlsUnlocked} onUnlockedChange={setControlsUnlocked} />
          </div>

          <CastPanel unlocked={controlsUnlocked} onSessionExpired={() => setControlsUnlocked(false)} />
          <SpotifyPanel unlocked={controlsUnlocked} onSessionExpired={() => setControlsUnlocked(false)} />
          <SpeedCard />
        </div>

        <footer className="dashboard-footer">
          <span>Smart Home</span>
          <span>Room to add more</span>
        </footer>
      </div>
    </main>
  )
}
