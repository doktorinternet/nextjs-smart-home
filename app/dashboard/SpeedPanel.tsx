'use client'

import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGauge } from '@fortawesome/free-solid-svg-icons'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'
import { copy, formatCopy, locale } from '@/app/copy'

type SpeedSample = {
  timestamp: string
  runStatus: 'Completed' | 'Failed'
  downloadMbps: number | null
  uploadMbps: number | null
}

type SpeedHistory = { status?: string; error?: string; results?: SpeedSample[] }

function formatSpeed(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} Mbit/s`
}

export default function SpeedPanel() {
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
    } catch {
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

      <div className="dashboard-panel-content">
      {loading && !history ? null : error ? (
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
      </div>
    </section>
  )
}