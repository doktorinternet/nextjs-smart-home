'use client'

import { useCallback, useEffect, useState } from 'react'
import { faGauge } from '@fortawesome/free-solid-svg-icons'
import DashboardPanel from './DashboardPanel'
import { useAutoFetch } from './useAutoFetch'
import { copy, formatCopy, locale } from '@/app/copy'
import type { SpeedHistoryResult } from '@/app/lib/speed-history'
import HistoryChart, { type HistoryChartRange, type HistoryChartRow, type HistoryChartSeries } from './HistoryChart'
import styles from './SpeedPanel.module.css'

type SpeedSample = SpeedHistoryResult
type SpeedHistory = { status?: string; error?: string; results?: SpeedSample[] }
type HistoryRangeId = 'day' | 'week' | 'month' | 'sixMonths'
type SpeedMetricId = Exclude<keyof SpeedSample, 'timestamp' | 'runStatus' | 'serverId' | 'downloadStatus' | 'uploadStatus'>
type SpeedMetric = HistoryChartSeries & { id: SpeedMetricId; group: 'throughput' | 'latency' | 'duration' }

const historyRanges: Record<HistoryRangeId, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  sixMonths: 183 * 24 * 60 * 60 * 1000,
}

const historyRangeOptions: HistoryChartRange[] = (Object.keys(historyRanges) as HistoryRangeId[])
  .map((id) => ({ id, label: copy.speed.ranges[id] }))

const speedMetrics: SpeedMetric[] = [
  { id: 'downloadMbps', label: copy.speed.download, unit: copy.speed.units.mbps, color: '#f4bd84', group: 'throughput', groupId: 'throughput', groupLabel: copy.speed.groups.throughput, scaleId: 'throughput' },
  { id: 'uploadMbps', label: copy.speed.upload, unit: copy.speed.units.mbps, color: '#8ab8ef', group: 'throughput', groupId: 'throughput', groupLabel: copy.speed.groups.throughput, scaleId: 'throughput' },
  { id: 'expectedDownloadMbps', label: copy.speed.expectedDownload, unit: copy.speed.units.mbps, color: '#d8a26f', group: 'throughput', groupId: 'throughput', groupLabel: copy.speed.groups.throughput, scaleId: 'throughput' },
  { id: 'expectedUploadMbps', label: copy.speed.expectedUpload, unit: copy.speed.units.mbps, color: '#6f9fd6', group: 'throughput', groupId: 'throughput', groupLabel: copy.speed.groups.throughput, scaleId: 'throughput' },
  { id: 'pingLatencyMs', label: copy.speed.pingLatency, unit: copy.speed.units.milliseconds, color: '#d7a4e8', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'pingJitterMs', label: copy.speed.pingJitter, unit: copy.speed.units.milliseconds, color: '#b18ad3', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'pingLowMs', label: copy.speed.pingLow, unit: copy.speed.units.milliseconds, color: '#e2c4ef', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'pingHighMs', label: copy.speed.pingHigh, unit: copy.speed.units.milliseconds, color: '#9064b2', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'downloadLatencyMs', label: copy.speed.downloadLatency, unit: copy.speed.units.milliseconds, color: '#73d6c4', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'downloadLatencyJitterMs', label: copy.speed.downloadLatencyJitter, unit: copy.speed.units.milliseconds, color: '#4cae9d', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'downloadLatencyLowMs', label: copy.speed.downloadLatencyLow, unit: copy.speed.units.milliseconds, color: '#9ce8da', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'downloadLatencyHighMs', label: copy.speed.downloadLatencyHigh, unit: copy.speed.units.milliseconds, color: '#328d7e', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'uploadLatencyMs', label: copy.speed.uploadLatency, unit: copy.speed.units.milliseconds, color: '#ef8d9b', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'uploadLatencyJitterMs', label: copy.speed.uploadLatencyJitter, unit: copy.speed.units.milliseconds, color: '#ca6275', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'uploadLatencyLowMs', label: copy.speed.uploadLatencyLow, unit: copy.speed.units.milliseconds, color: '#f5bac2', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'uploadLatencyHighMs', label: copy.speed.uploadLatencyHigh, unit: copy.speed.units.milliseconds, color: '#a84457', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'latency' },
  { id: 'packetLossPercent', label: copy.speed.packetLoss, unit: copy.speed.units.percent, color: '#f2cf64', group: 'latency', groupId: 'latency', groupLabel: copy.speed.groups.latency, scaleId: 'packet-loss' },
  { id: 'durationSeconds', label: copy.speed.duration, unit: copy.speed.units.seconds, color: '#a4cf78', group: 'duration', groupId: 'duration', groupLabel: copy.speed.groups.duration, scaleId: 'duration-seconds' },
  { id: 'downloadElapsedMs', label: copy.speed.downloadElapsed, unit: copy.speed.units.milliseconds, color: '#80ad56', group: 'duration', groupId: 'duration', groupLabel: copy.speed.groups.duration, scaleId: 'duration-ms' },
  { id: 'uploadElapsedMs', label: copy.speed.uploadElapsed, unit: copy.speed.units.milliseconds, color: '#c4df9d', group: 'duration', groupId: 'duration', groupLabel: copy.speed.groups.duration, scaleId: 'duration-ms' },
  { id: 'totalElapsedMs', label: copy.speed.totalElapsed, unit: copy.speed.units.milliseconds, color: '#658c40', group: 'duration', groupId: 'duration', groupLabel: copy.speed.groups.duration, scaleId: 'duration-ms' },
]

function formatMetricValue(value: number | null | undefined, unit: string) {
  return value == null || !Number.isFinite(value)
    ? copy.speed.noValue
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`
}

export default function SpeedPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.networkSpeed')
  const [history, setHistory] = useState<SpeedHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyRangeId, setHistoryRangeId] = useState<HistoryRangeId>('month')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/speed-history?limit=5000', { cache: 'no-store' })
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

  const now = Date.now()
  const from = now - historyRanges[historyRangeId]
  const samples = (history?.results ?? [])
    .filter((sample) => sample.runStatus === 'Completed'
      && Date.parse(sample.timestamp) >= from
      && speedMetrics.some(({ id }) => sample[id] !== null))
    .reverse()
  const latest = samples[samples.length - 1]
  const chartData: HistoryChartRow[] = samples.map((sample) => {
    const row: HistoryChartRow = { timestamp: Date.parse(sample.timestamp) }
    for (const metric of speedMetrics) {
      const value = sample[metric.id]
      if (typeof value === 'number') row[metric.id] = value
    }
    return row
  })
  const latestValues = new Map<string, string | number>()
  for (const sample of samples) {
    for (const metric of speedMetrics) {
      const value = sample[metric.id]
      if (typeof value === 'number') latestValues.set(metric.id, value)
    }
  }
  return (
    <DashboardPanel
      className={'dashboard-module dashboard-live-card dashboard-speed-card ' + styles.speedPanel}
      headingId="speed-heading"
      icon={faGauge}
      eyebrow={copy.speed.eyebrow}
      title={copy.speed.title}
      label={copy.speed.label}
      autoFetch={autoFetch}
      onRefresh={() => void load()}
      refreshLabel={copy.speed.refresh}
      refreshing={loading}
      headerAddon={latest && <span className="dashboard-speed-time">{copy.speed.latest}</span>}
    >
        {loading && !history ? null : error ? (
          <p className="dashboard-live-message is-error" role="status">{error}</p>
        ) : autoFetch.ready && !autoFetch.enabled && !history ? (
          null
        ) : !latest ? (
          <p className="dashboard-live-message">{historyRangeId === 'month' ? copy.speed.empty : copy.speed.historyRangeEmpty}</p>
        ) : (
          <>
            <HistoryChart
              data={chartData}
              series={speedMetrics}
              ranges={historyRangeOptions}
              selectedRangeId={historyRangeId}
              onRangeChange={(id) => setHistoryRangeId(id as HistoryRangeId)}
              xDomain={[from, now]}
              xTickFormatter={(value) => historyRangeId === 'day'
                ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                : new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
              rangeLabel={copy.speed.historyRangeLabel}
              legendLabel={copy.speed.historyLegend}
              latestValues={latestValues}
              footer={formatCopy(copy.speed.historyCount, { count: samples.length })}
            />
            <p className="dashboard-speed-updated">{new Date(latest.timestamp).toLocaleString(locale)}</p>
          </>
        )}
    </DashboardPanel>
  )
}