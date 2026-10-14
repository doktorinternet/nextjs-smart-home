'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch';
import { copy, formatCopy, locale } from '@/app/copy';
import { airMetricDefinitions, printerMetricDefinitions } from '@/app/lib/air-metrics';
import HistoryChart, { type HistoryChartRange, type HistoryChartRow, type HistoryChartSeries } from '@/app/components/ui/HistoryChart';

type Status = { appliance: string; updatedAt: string; metrics: Array<{ label: string; value: string }> };
type Measurement = { id: number; kind: 'measurement'; sourceId: string; metricId: string; value: number; unit: string; observedAt: string };
type EventRecord = { id: number; kind: 'event'; sourceId: string; eventType: string; eventValue?: string; observedAt: string };
type HistoryRecord = Measurement | EventRecord;
type Series = HistoryChartSeries;
type HistoryRangeId = 'day' | 'week' | 'month' | 'sixMonths';

const historyRanges = {
  day: { label: copy.electrolux.ranges.day, durationMs: 24 * 60 * 60 * 1000, bucket: 'minute' },
  week: { label: copy.electrolux.ranges.week, durationMs: 7 * 24 * 60 * 60 * 1000, bucket: 'ten-minute' },
  month: { label: copy.electrolux.ranges.month, durationMs: 30 * 24 * 60 * 60 * 1000, bucket: 'hour' },
  sixMonths: { label: copy.electrolux.ranges.sixMonths, durationMs: 183 * 24 * 60 * 60 * 1000, bucket: 'day' },
} as const;

const historyRangeOptions: HistoryChartRange[] = Object.entries(historyRanges).map(([id, range]) => ({ id, label: range.label }));
const series: Series[] = [
  ...airMetricDefinitions.map(({ id, label, unit, color, kind }) => ({
    id, label, unit, color, kind, groupId: 'air', groupLabel: copy.electrolux.seriesGroups.air,
  })),
  ...printerMetricDefinitions.map((item) => ({
    ...item, groupId: 'printer', groupLabel: copy.electrolux.seriesGroups.printer,
  })),
];

function isHistory(value: unknown): value is HistoryRecord[] {
  return Array.isArray(value) && value.every((record) => typeof record === 'object' && record !== null
    && typeof (record as Record<string, unknown>).id === 'number'
    && ['measurement', 'event'].includes(String((record as Record<string, unknown>).kind))
    && typeof (record as Record<string, unknown>).observedAt === 'string');
}

function isStatus(value: unknown): value is Status {
  if (typeof value !== 'object' || value === null) return false;
  const status = value as Record<string, unknown>;
  return typeof status.appliance === 'string' && typeof status.updatedAt === 'string'
    && Array.isArray(status.metrics)
    && status.metrics.every((metric) => typeof metric === 'object' && metric !== null
      && typeof (metric as Record<string, unknown>).label === 'string'
      && typeof (metric as Record<string, unknown>).value === 'string');
}

export default function ElectroluxPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.electrolux');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [historyRangeId, setHistoryRangeId] = useState<HistoryRangeId>('month');
  const historyRange = historyRanges[historyRangeId];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/electrolux/status', { cache: 'no-store' });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(formatCopy(copy.electrolux.httpError, { status: response.status }));
        return;
      }
      if (!isStatus(result)) {
        setError(copy.electrolux.invalidStatus);
        return;
      }
      setStatus(result);
      setError(null);
    } catch {
      setError(copy.electrolux.unreachable);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - historyRange.durationMs).toISOString();
      const queries = [
        ...series.filter(({ kind }) => kind === 'measurement').map(({ id }) => `kind=measurement&metricId=${encodeURIComponent(id)}&bucket=${historyRange.bucket}`),
        'kind=event&limit=1000',
        `kind=event&eventType=started&includeActiveAt=${encodeURIComponent(from)}&limit=1000`,
      ];
      const responses = await Promise.all(queries.map((query) => fetch(`/api/telemetry/history?${query}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=1500`, { cache: 'no-store' })));
      const payloads: unknown[] = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      const valid = payloads.every((result, index) => responses[index].ok && typeof result === 'object' && result !== null
        && isHistory((result as { records?: unknown }).records));
      if (!valid) {
        setHistoryError(true);
        return;
      }
      const records = payloads.flatMap((result) => (result as { records: HistoryRecord[] }).records);
      const unique = new Map(records.map((record) => [record.id, record]));
      setHistory([...unique.values()]);
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }, [historyRange]);

  const refreshAndLoadHistory = useCallback(async () => {
    await refresh();
    await refreshHistory();
  }, [refresh, refreshHistory]);

  useEffect(() => {
    if (!autoFetch.ready) return;
    if (!autoFetch.enabled) {
      void refreshHistory();
      return;
    }
    void refreshAndLoadHistory();
    const interval = window.setInterval(() => { void refreshAndLoadHistory(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [autoFetch.ready, autoFetch.enabled, refreshAndLoadHistory, refreshHistory]);

  const chartData = useMemo<HistoryChartRow[]>(() => {
    const rows = new Map<number, Record<string, number | string>>();
    const rowAt = (timestamp: number) => {
      let row = rows.get(timestamp);
      if (!row) {
        row = { timestamp };
        rows.set(timestamp, row);
      }
      return row;
    };
    const stateValues = new Map<string, string[]>();
    const stateEvents = history.filter((record): record is EventRecord => record.kind === 'event');
    const measurements = history.filter((record): record is Measurement => record.kind === 'measurement');
    for (const measurement of measurements) {
      if (!series.some(({ id, kind }) => id === measurement.metricId && kind === 'measurement')) continue;
      rowAt(Date.parse(measurement.observedAt))[measurement.metricId] = measurement.value;
    }
    const addState = (metricId: string, timestamp: number, value: string) => {
      const labels = stateValues.get(metricId) ?? [];
      let index = labels.indexOf(value);
      if (index < 0) {
        index = labels.length;
        labels.push(value);
        stateValues.set(metricId, labels);
      }
      const row = rowAt(timestamp);
      row[metricId] = index;
      row[`${metricId}Label`] = value;
    };
    for (const event of stateEvents) {
      if (event.eventType.endsWith('-state') && event.eventType.startsWith('air.')) {
        const metricId = event.eventType.slice(0, -'-state'.length);
        if (series.some(({ id, kind }) => id === metricId && kind === 'state')) {
          addState(metricId, Date.parse(event.observedAt), event.eventValue ?? 'Unknown');
        }
      } else if (event.eventType === 'job-state') {
        addState('printer.job-state', Date.parse(event.observedAt), event.eventValue ?? 'Unknown');
      } else if (event.eventType === 'connection-state') {
        addState('printer.connection-state', Date.parse(event.observedAt), event.eventValue ?? 'Unknown');
      } else if (event.eventType === 'started' || event.eventType === 'stopped') {
        addState('printer.job-state', Date.parse(event.observedAt), event.eventType === 'started' ? 'Printing' : event.eventValue ?? 'Stopped');
      }
    }
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([timestamp, row]) => ({ ...row, timestamp }));
  }, [history]);

  const latestHistoryValues = useMemo(() => {
    const values = new Map<string, string | number>();
    for (const row of chartData) {
      for (const item of series) {
        if (row[item.id] === undefined) continue;
        values.set(item.id, item.kind === 'state' ? String(row[`${item.id}Label`] ?? 'Unknown') : Number(row[item.id]));
      }
    }
    return values;
  }, [chartData]);
  const currentAirValues = useMemo(() => new Map(status?.metrics.map(({ label, value }) => [label, value]) ?? []), [status]);
  const latestChartValues = new Map(latestHistoryValues);
  for (const item of series.filter(({ id }) => id.startsWith('air.'))) {
    const value = currentAirValues.get(item.label);
    if (value !== undefined) latestChartValues.set(item.id, value);
  }

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="air-quality-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faWind} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.electrolux.eyebrow}</p>
          <h2 id="air-quality-heading">{copy.electrolux.title}</h2>
        </div>
        <AutoRefreshControl
          label={copy.electrolux.label}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={refreshAndLoadHistory}
          refreshLabel={copy.electrolux.refresh}
          refreshing={loading}
        />
      </div>
      <div className="dashboard-panel-content">
        {error && !status ? <p>{error}</p> : null}
        {history.length ? (
          <HistoryChart
            data={chartData}
            series={series}
            ranges={historyRangeOptions}
            selectedRangeId={historyRangeId}
            onRangeChange={(id) => setHistoryRangeId(id as HistoryRangeId)}
            xDomain={[Date.now() - historyRange.durationMs, Date.now()]}
            xTickFormatter={(value) => historyRangeId === 'day'
              ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
              : new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            rangeLabel={copy.electrolux.historyRangeLabel}
            legendLabel={copy.electrolux.historyLegend}
            latestValues={latestChartValues}
            footer={formatCopy(copy.electrolux.historyCount, { count: history.length })}
          />
        ) : <p className="dashboard-live-note">{historyError ? copy.electrolux.historyError : copy.electrolux.historyEmpty}</p>}
      </div>
    </section>
  );
}
