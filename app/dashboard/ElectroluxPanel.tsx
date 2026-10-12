'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch';
import { copy, formatCopy, locale } from '@/app/copy';
import { airMetricDefinitions, printerMetricDefinitions } from '@/app/lib/air-metrics';
import { ChartContainer, ChartTooltip } from '@/app/components/ui/chart';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

type Status = { appliance: string; updatedAt: string; metrics: Array<{ label: string; value: string }> };
type Measurement = { id: number; kind: 'measurement'; sourceId: string; metricId: string; value: number; unit: string; observedAt: string };
type EventRecord = { id: number; kind: 'event'; sourceId: string; eventType: string; eventValue?: string; observedAt: string };
type HistoryRecord = Measurement | EventRecord;
type Series = { id: string; label: string; unit: string; color: string; kind: 'measurement' | 'state' };

const series: Series[] = [
  ...airMetricDefinitions.map(({ id, label, unit, color, kind }) => ({ id, label, unit, color, kind })),
  ...printerMetricDefinitions,
];
const historyWindowMs = 24 * 60 * 60 * 1000;
const chartConfig = Object.fromEntries(series.map(({ id, label, unit, color }) => [id, { label, unit, color }]));

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
  const [visibleSeries, setVisibleSeries] = useState<string[]>(series.map(({ id }) => id));

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
      const from = new Date(Date.now() - historyWindowMs).toISOString();
      const queries = [
        ...series.filter(({ kind }) => kind === 'measurement').map(({ id }) => `kind=measurement&metricId=${encodeURIComponent(id)}&bucket=minute`),
        `kind=event&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=1000`,
        `kind=event&eventType=started&includeActiveAt=${encodeURIComponent(from)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=1000`,
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
  }, []);

  const refreshAndLoadHistory = useCallback(async () => {
    await refresh();
    await refreshHistory();
  }, [refresh, refreshHistory]);

  useEffect(() => {
    void refreshHistory();
    if (!autoFetch.ready || !autoFetch.enabled) return;
    void refreshAndLoadHistory();
    const interval = window.setInterval(() => { void refreshAndLoadHistory(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [autoFetch.ready, autoFetch.enabled, refreshAndLoadHistory, refreshHistory]);

  const chartData = useMemo(() => {
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

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="air-quality-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faWind} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.electrolux.eyebrow}</p>
          <h2 id="air-quality-heading">{copy.electrolux.title}</h2>
        </div>
        <span className="dashboard-source">Pure A9</span>
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
      <div className="dashboard-live-content" aria-live="polite">
        {error && !status ? <p>{error}</p> : null}
        <div className="air-history-layout">
          <div className="air-history-chart">
            <h3>Historik · luft och skrivare</h3>
            {history.length ? <>
              <p className="dashboard-live-note">Senaste 24 timmarna</p>
              <div className="air-history-legend" aria-label="Diagramförklaring">
                {series.map((item) => <label key={item.id}><input type="checkbox" checked={visibleSeries.includes(item.id)} onChange={() => setVisibleSeries((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span style={{ backgroundColor: item.color }} />{item.label}</label>)}
              </div>
              <ChartContainer className="air-history-recharts" config={chartConfig}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.12)" />
                  <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(value: number) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} />
                  {series.map((item) => <YAxis key={item.id} yAxisId={item.id} hide domain={item.kind === 'state' ? [0, 'auto'] : ['auto', 'auto']} />)}
                  <ChartTooltip config={chartConfig} />
                  {series.filter((item) => visibleSeries.includes(item.id)).map((item) => <Line key={item.id} type={item.kind === 'state' ? 'stepAfter' : 'monotone'} dataKey={item.id} name={item.id} yAxisId={item.id} stroke={item.color} dot={item.kind === 'state'} connectNulls isAnimationActive={false} />)}
                </LineChart>
              </ChartContainer>
              <p className="dashboard-live-note">{history.length} mätningar och händelser · varje mätserie har en egen skala.</p>
            </> : <p className="dashboard-live-note">{historyError ? 'Historiken kunde inte hämtas.' : 'Historik visas när insamlingen har körts.'}</p>}
          </div>
          <aside className="air-history-note" aria-label="Aktuell luftrenarinformation">
            {status ? <>
              <p className="dashboard-device-name">{status.appliance}</p>
              {status.metrics.length > 0 ? (
                <dl className="air-quality-metrics">
                  {status.metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
                </dl>
              ) : <p>{copy.electrolux.noMetrics}</p>}
              {error ? <p className="dashboard-live-note">{formatCopy(copy.electrolux.updateFailed, { error })}</p> : null}
              <p className="dashboard-live-note">{formatCopy(copy.electrolux.updated, { time: new Date(status.updatedAt).toLocaleTimeString(locale) })}</p>
            </> : null}
          </aside>
        </div>
      </div>
      </div>
    </section>
  );
}
