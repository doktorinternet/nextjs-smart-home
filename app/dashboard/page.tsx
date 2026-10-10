'use client'

import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGauge, faPlus, faPrint, faTrain } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import CustomTimeTable from '@/app/components/TimeTable/CustomTimeTable'
import CastPanel from './CastPanel'
import SpotifyPanel from './SpotifyPanel'
import ElectroluxPanel from './ElectroluxPanel'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'
import { copy, formatCopy, locale } from '@/app/copy'

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
  return minutes > 0
    ? formatCopy(copy.printer.minutesAndSeconds, { minutes, seconds: remainingSeconds })
    : formatCopy(copy.printer.seconds, { seconds: remainingSeconds })
}

function formatSpeed(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} Mbit/s`
}

function printerStateLabel(state: string) {
  const labels: Record<string, string> = {
    Operational: copy.printer.states.Operational,
    Printing: copy.printer.states.Printing,
    Paused: copy.printer.states.Paused,
    Offline: copy.printer.states.Offline,
    Closed: copy.printer.states.Closed,
    Unknown: copy.printer.states.Unknown,
  }
  return labels[state] ?? state
}

function PrinterCard() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.printer')
  const [printer, setPrinter] = useState<PrinterStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controlBusy, setControlBusy] = useState(false)
  const [controlMessage, setControlMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/printer/status', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(copy.printer.loadError)
      setPrinter(result)
      setError(null)
    } catch (reason) {
      setError(copy.printer.loadError)
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

  async function runPrinterCommand(command: 'pause' | 'resume' | 'cancel') {
    if (controlBusy) return
    if (command === 'cancel' && !window.confirm(copy.printer.confirmCancel)) return
    setControlBusy(true)
    setControlMessage(null)
    try {
      const response = await fetch('/api/printer/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      if (!response.ok) {
        setControlMessage(copy.printer.commandFailed)
      } else {
        setControlMessage(command === 'cancel'
          ? copy.printer.cancelSent
          : formatCopy(copy.printer.commandSent, { action: copy.printer.commandActions[command] }))
      }
    } catch {
      setControlMessage(copy.printer.unreachable)
    } finally {
      setControlBusy(false)
    }
  }

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="printer-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faPrint} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.printer.eyebrow}</p>
          <h2 id="printer-heading">{copy.printer.title}</h2>
        </div>
        {!loading && !error && (
          <span className={`dashboard-live-status${disconnected ? ' is-offline' : ''}`}>
            <span aria-hidden="true" />{disconnected ? copy.printer.disconnected : printerStateLabel(connection)}
          </span>
        )}
        <AutoRefreshControl
          label={copy.printer.label}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void load()}
          refreshLabel={copy.printer.refresh}
          refreshing={loading}
        />
      </div>

      {loading ? (
        <p className="dashboard-live-message" role="status">{copy.printer.loading}</p>
      ) : error ? (
        <p className="dashboard-live-message is-error" role="status">{error}</p>
      ) : autoFetch.ready && !autoFetch.enabled && !printer ? (
        null
      ) : disconnected ? (
        <p className="dashboard-live-message">{copy.printer.disconnectedHelp}</p>
      ) : (
        <div className="dashboard-printer-content" aria-live="polite">
          <div className="dashboard-printer-job">
            <span className="dashboard-live-label">{copy.printer.activeJob}</span>
            <strong>{fileName || (jobState === 'Operational' ? copy.printer.noActivePrint : printerStateLabel(jobState))}</strong>
            <span className="dashboard-job-state">{printerStateLabel(jobState)}</span>
          </div>
          {hasProgress ? (
            <div className="dashboard-progress-wrap">
              <div className="dashboard-progress-label">
                <span>{copy.printer.progress}</span><strong>{Math.round(progress)}%</strong>
              </div>
              <div className="dashboard-progress-track" role="progressbar" aria-label={copy.printer.progressAria} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))}>
                <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
              {remaining && <span className="dashboard-remaining">{formatCopy(copy.printer.remaining, { duration: remaining })}</span>}
            </div>
          ) : (
            <p className="dashboard-printer-idle">{jobState === 'Operational' ? copy.printer.ready : copy.printer.progressUnavailable}</p>
          )}
        </div>
      )}

      <div className="dashboard-printer-controls">
        <div className="dashboard-control-actions">
          <div className="dashboard-control-actions-row">
            <button type="button" onClick={() => void runPrinterCommand('pause')} disabled={controlBusy || !canPause}>{copy.printer.pause}</button>
            <button type="button" onClick={() => void runPrinterCommand('resume')} disabled={controlBusy || !canResume}>{copy.printer.resume}</button>
            <button className="is-danger" type="button" onClick={() => void runPrinterCommand('cancel')} disabled={controlBusy || !canCancel}>{copy.printer.cancel}</button>
          </div>
        </div>
        <p className="dashboard-control-message" role="status" aria-live="polite">{controlMessage}</p>
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
      if (!response.ok || result.status !== 'available') throw new Error(copy.speed.loadError)
      setHistory(result)
      setError(null)
    } catch (reason) {
      setError(copy.speed.loadError)
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
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faGauge} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.speed.eyebrow}</p>
          <h2 id="speed-heading">{copy.speed.title}</h2>
        </div>
        {latest && <span className="dashboard-speed-time">{copy.speed.latest}</span>}
        <AutoRefreshControl
          label={copy.speed.label}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void load()}
          refreshLabel={copy.speed.refresh}
          refreshing={loading}
        />
      </div>

      {loading ? (
        <p className="dashboard-live-message" role="status">{copy.speed.loading}</p>
      ) : error ? (
        <p className="dashboard-live-message is-error" role="status">{error}</p>
      ) : autoFetch.ready && !autoFetch.enabled && !history ? (
        null
      ) : !latest ? (
        <p className="dashboard-live-message">{copy.speed.empty}</p>
      ) : (
        <div className="dashboard-speed-content">
          <div className="dashboard-speed-values" aria-live="polite">
            <div><span className="dashboard-speed-dot is-download" /><span className="dashboard-live-label">{copy.speed.download}</span><strong>{formatSpeed(latest.downloadMbps)}</strong></div>
            <div><span className="dashboard-speed-dot is-upload" /><span className="dashboard-live-label">{copy.speed.upload}</span><strong>{formatSpeed(latest.uploadMbps)}</strong></div>
          </div>
          <div className="dashboard-speed-chart-wrap">
            <svg className="dashboard-speed-chart" viewBox="0 0 300 100" role="img" aria-label={formatCopy(copy.speed.chartAria, { download: formatSpeed(latest.downloadMbps), upload: formatSpeed(latest.uploadMbps) })}>
              <line x1="8" y1="88" x2="292" y2="88" />
              {chartPoints('downloadMbps') && <polyline className="is-download" points={chartPoints('downloadMbps')} />}
              {chartPoints('uploadMbps') && <polyline className="is-upload" points={chartPoints('uploadMbps')} />}
              {samples.length === 1 && samples[0].downloadMbps != null && <circle className="is-download" cx="150" cy={88 - (samples[0].downloadMbps / max) * 76} r="3.5" />}
              {samples.length === 1 && samples[0].uploadMbps != null && <circle className="is-upload" cx="150" cy={88 - (samples[0].uploadMbps / max) * 76} r="3.5" />}
            </svg>
            <div className="dashboard-speed-chart-labels"><span>{copy.speed.older}</span><span>{copy.speed.newer}</span></div>
          </div>
          <p className="dashboard-speed-updated">{new Date(latest.timestamp).toLocaleString(locale)}</p>
        </div>
      )}
    </section>
  )
}

type ModuleCardProps = {
  eyebrow: string
  title: string
  description: string
  icon: IconDefinition
}

function ModuleCard({ eyebrow, title, description, icon }: ModuleCardProps) {
  return (
    <section className="dashboard-module" aria-label={title}>
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={icon} /></span>
        <div>
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="dashboard-module-empty">
        <span className="dashboard-empty-mark" aria-hidden="true"><FontAwesomeIcon icon={faPlus} /></span>
        <p>{description}</p>
      </div>
    </section>
  )
}

export default function Page() {
  const transitAutoFetch = useAutoFetch('dashboard.autoFetch.tramDepartures')
  const [refreshDepartures, setRefreshDepartures] = useState<(() => void) | null>(null)
  const [transitFetchState, setTransitFetchState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null })
  const handleRefreshReady = useCallback((refresh: (() => void) | null) => setRefreshDepartures(() => refresh), [])
  const handleTransitFetchStateChange = useCallback((state: { loading: boolean; error: string | null }) => setTransitFetchState(state), [])

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">H</span>
            <div>
              <h1>{copy.dashboard.title}</h1>
            </div>
          </div>
          <div>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="dashboard-module dashboard-transit" aria-labelledby="transit-heading">
            <div className="dashboard-module-heading">
              <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faTrain} /></span>
              <div>
                <p className="dashboard-eyebrow">{copy.dashboard.travel}</p>
                <h2 id="transit-heading">{copy.dashboard.departures}</h2>
              </div>
              <span className="dashboard-source">Västtrafik</span>
              <AutoRefreshControl
                label={copy.dashboard.transit}
                {...transitAutoFetch}
                onChange={transitAutoFetch.setEnabled}
                onRefresh={() => refreshDepartures?.()}
                refreshLabel={copy.transit.refresh}
                refreshing={transitFetchState.loading}
                refreshError={Boolean(transitFetchState.error)}
                refreshDisabled={!refreshDepartures}
              />
            </div>
            <div className="dashboard-transit-content">
              <CustomTimeTable
                autoFetch={transitAutoFetch}
                onRefreshReady={handleRefreshReady}
                onFetchStateChange={handleTransitFetchStateChange}
              />
            </div>
          </section>

          <div className="dashboard-side-stack">
            <ElectroluxPanel />
            <PrinterCard />
          </div>

          <CastPanel />
          <SpotifyPanel />
          <SpeedCard />
        </div>

        <footer className="dashboard-footer">
          <span>{copy.dashboard.smartHome}</span>
          <span>{copy.dashboard.moreSpace}</span>
        </footer>
      </div>
    </main>
  )
}
