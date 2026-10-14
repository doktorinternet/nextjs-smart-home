'use client'

import { useCallback, useEffect, useState } from 'react'
import { faPrint } from '@fortawesome/free-solid-svg-icons'
import RectangularButton from '@/app/components/ui/RectangularButton'
import DashboardPanel from './DashboardPanel'
import { useAutoFetch, type AutoRefreshStatusType } from './useAutoFetch'
import { copy, formatCopy } from '@/app/copy'
import styles from './PrinterPanel.module.css'

type PrinterStatus = {
  connection?: { state?: string }
  job?: {
    state?: string
    details?: { file?: { name?: string; display?: string } | null } | null
    progress?: { completion?: number | null; printTimeLeft?: number | null } | null
  }
}

function displayDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return minutes > 0
    ? formatCopy(copy.printer.minutesAndSeconds, { minutes, seconds: remainingSeconds })
    : formatCopy(copy.printer.seconds, { seconds: remainingSeconds })
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

export default function PrinterPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.printer')
  const [printer, setPrinter] = useState<PrinterStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controlBusy, setControlBusy] = useState(false)
  const [controlMessage, setControlMessage] = useState<string | null>(null)
  const [controlMessageType, setControlMessageType] = useState<AutoRefreshStatusType>('info')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/printer/status', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(copy.printer.loadError)
      setPrinter(result)
      setError(null)
    } catch {
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
    setControlMessageType('info')
    try {
      const response = await fetch('/api/printer/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      if (!response.ok) {
        setControlMessage(copy.printer.commandFailed)
        setControlMessageType('error')
      } else {
        setControlMessage(command === 'cancel'
          ? copy.printer.cancelSent
          : formatCopy(copy.printer.commandSent, { action: copy.printer.commandActions[command] }))
        setControlMessageType('success')
      }
    } catch {
      setControlMessage(copy.printer.unreachable)
      setControlMessageType('error')
    } finally {
      setControlBusy(false)
    }
  }

  return (
    <DashboardPanel
      className={'dashboard-module ' + styles.printerPanel}
      headingId="printer-heading"
      icon={faPrint}
      eyebrow={copy.printer.eyebrow}
      title={copy.printer.title}
      label={copy.printer.label}
      autoFetch={autoFetch}
      onRefresh={() => void load()}
      refreshLabel={copy.printer.refresh}
      refreshing={loading}
      headerAddon={printer && !error && (
          <span className={`dashboard-live-status${disconnected ? ' is-offline' : ''}`}>
            <span aria-hidden="true" />{disconnected ? copy.printer.disconnected : printerStateLabel(connection)}
          </span>
      )}
      statusMessage={controlMessage}
      statusType={controlMessageType}
      statusPosition="before"
    >
        {loading && !printer ? null : error ? (
          <p className="dashboard-live-message is-error" role="status">{error}</p>
        ) : autoFetch.ready && !autoFetch.enabled && !printer ? (
          null
        ) : disconnected ? (
          <p className="dashboard-live-message">{copy.printer.disconnectedHelp}</p>
        ) : (
          <>
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
          </>
        )}

        <div className="dashboard-printer-controls">
          <div className="dashboard-control-actions">
            <div className="dashboard-control-actions-row">
              <RectangularButton type="button" onClick={() => void runPrinterCommand('pause')} disabled={controlBusy || !canPause}>{copy.printer.pause}</RectangularButton>
              <RectangularButton type="button" onClick={() => void runPrinterCommand('resume')} disabled={controlBusy || !canResume}>{copy.printer.resume}</RectangularButton>
              <RectangularButton className="is-danger" type="button" onClick={() => void runPrinterCommand('cancel')} disabled={controlBusy || !canCancel}>{copy.printer.cancel}</RectangularButton>
            </div>
          </div>
        </div>
    </DashboardPanel>
  )
}