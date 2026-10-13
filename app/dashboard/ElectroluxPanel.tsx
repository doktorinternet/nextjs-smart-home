'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch';
import { copy, formatCopy, locale } from '@/app/copy';
import { airMetricDefinitions, printerMetricDefinitions } from '@/app/lib/air-metrics';
import { ChartContainer, ChartTooltipContent } from '@/app/components/ui/chart';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './ElectroluxPanel.module.css';

type Status = { appliance: string; updatedAt: string; metrics: Array<{ label: string; value: string }> };
type Measurement = { id: number; kind: 'measurement'; sourceId: string; metricId: string; value: number; unit: string; observedAt: string };
type EventRecord = { id: number; kind: 'event'; sourceId: string; eventType: string; eventValue?: string; observedAt: string };
type HistoryRecord = Measurement | EventRecord;
type Series = { id: string; label: string; unit: string; color: string; kind: 'measurement' | 'state' };
type ChartRow = Record<string, number | string> & { timestamp: number };
type HistoryRangeId = 'day' | 'week' | 'month' | 'sixMonths';
type SeriesContextMenu = { seriesId: string; left: number; top: number };

const historyRanges = {
  day: { label: 'Dag', description: 'Senaste 24 timmarna', durationMs: 24 * 60 * 60 * 1000, bucket: 'minute' },
  week: { label: 'Vecka', description: 'Senaste veckan', durationMs: 7 * 24 * 60 * 60 * 1000, bucket: 'ten-minute' },
  month: { label: 'Månad', description: 'Senaste månaden', durationMs: 30 * 24 * 60 * 60 * 1000, bucket: 'hour' },
  sixMonths: { label: '6 månader', description: 'Senaste 6 månaderna', durationMs: 183 * 24 * 60 * 60 * 1000, bucket: 'day' },
} as const;

const series: Series[] = [
  ...airMetricDefinitions.map(({ id, label, unit, color, kind }) => ({ id, label, unit, color, kind })),
  ...printerMetricDefinitions,
];
const seriesGroups = [
  { label: 'Luftkvalitet', series: series.filter(({ id }) => id.startsWith('air.')) },
  { label: 'Skrivare', series: series.filter(({ id }) => id.startsWith('printer.')) },
];
const chartConfig = Object.fromEntries(series.map(({ id, label, unit, color }) => [id, { label, unit, color }]));
const electroluxMenuCopy = copy.electrolux as typeof copy.electrolux & { isolate: string; displayAll: string };

function formatLegendValue(value: string | number | undefined, unit: string): string {
  if (typeof value === 'number') {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;
  }
  return value ?? '—';
}

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
  const [visibleSeries, setVisibleSeries] = useState<string[]>(series.map(({ id }) => id));
  const [seriesContextMenu, setSeriesContextMenu] = useState<SeriesContextMenu | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuActionRef = useRef<HTMLButtonElement | null>(null);
  const contextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const historyRange = historyRanges[historyRangeId];

  const openSeriesContextMenu = (seriesId: string, trigger: HTMLButtonElement, x: number, y: number) => {
    const edge = 8;
    const menuWidth = 184;
    const menuHeight = 98;
    contextMenuTriggerRef.current = trigger;
    setSeriesContextMenu({
      seriesId,
      left: Math.max(edge, Math.min(x, window.innerWidth - menuWidth - edge)),
      top: Math.max(edge, Math.min(y, window.innerHeight - menuHeight - edge)),
    });
  };

  const cancelLongPress = (resetTriggered = false) => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressOrigin.current = null;
    if (resetTriggered) longPressTriggered.current = false;
  };

  useEffect(() => {
    if (!seriesContextMenu) return;
    contextMenuActionRef.current?.focus();
    const closeOutsideMenu = (event: globalThis.PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setSeriesContextMenu(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSeriesContextMenu(null);
      requestAnimationFrame(() => contextMenuTriggerRef.current?.focus());
    };
    window.addEventListener('pointerdown', closeOutsideMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutsideMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [seriesContextMenu]);

  useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);

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

  const chartData = useMemo<ChartRow[]>(() => {
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
  const axisSeries = series.find(({ id }) => visibleSeries.includes(id));

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
        <div className={styles.historyChart}>
          <div className={styles.historyRangeTabs} role="group" aria-label="Välj tidsperiod">
            {Object.entries(historyRanges).map(([id, range]) => (
              <button
                className={historyRangeId === id ? styles.isActive : ''}
                type="button"
                key={id}
                aria-pressed={historyRangeId === id}
                onClick={() => setHistoryRangeId(id as HistoryRangeId)}
              >{range.label}</button>
            ))}
          </div>
          {history.length ? (
            <ChartContainer className={styles.historyRecharts} config={chartConfig}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.12)" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={[Date.now() - historyRange.durationMs, Date.now()]}
                  tickFormatter={(value: number) => historyRangeId === 'day'
                    ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                    : new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                />
                {series.map((item) => {
                  const isAxisSeries = item.id === axisSeries?.id;
                  return (
                    <YAxis
                      key={item.id}
                      yAxisId={item.id}
                      hide={!isAxisSeries}
                      width={isAxisSeries ? 42 : 0}
                      tick={isAxisSeries ? { fill: '#bac2ce', fontSize: 10 } : false}
                      tickLine={false}
                      axisLine={false}
                      tickCount={5}
                      label={isAxisSeries ? {
                        value: `${item.label}${item.unit ? ` (${item.unit})` : ''}`,
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#bac2ce',
                        fontSize: 10,
                      } : undefined}
                      tickFormatter={(value: number) => item.kind === 'state'
                        ? String(chartData.find((row) => row[item.id] === value)?.[`${item.id}Label`] ?? '')
                        : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}
                      domain={item.kind === 'state' ? [0, 'auto'] : ['auto', 'auto']}
                    />
                  );
                })}
                <Tooltip
                  content={<ChartTooltipContent config={chartConfig} />}
                  cursor={{ stroke: 'rgba(255,255,255,.45)', strokeDasharray: '3 3' }}
                  isAnimationActive={false}
                />
                {series.filter((item) => visibleSeries.includes(item.id)).map((item) => <Line key={item.id} type={item.kind === 'state' ? 'stepAfter' : 'monotone'} dataKey={item.id} name={item.id} yAxisId={item.id} stroke={item.color} dot={item.kind === 'state'} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />)}
              </LineChart>
            </ChartContainer>
          ) : <p className="dashboard-live-note">{historyError ? 'Historiken kunde inte hämtas.' : 'Historik visas när insamlingen har körts.'}</p>}
          <div className={styles.historySeriesGroups} aria-label="Diagramförklaring">
            {seriesGroups.map((group) => (
              <section className={styles.historySeriesGroup} key={group.label}>
                <h4>{group.label}</h4>
                <div className={styles.historyLegend} role="group" aria-label={group.label}>
                  {group.series.map((item) => {
                    const isVisible = visibleSeries.includes(item.id);
                    const latestValue = item.id.startsWith('air.')
                      ? currentAirValues.get(item.label) ?? latestHistoryValues.get(item.id)
                      : latestHistoryValues.get(item.id);
                    return (
                      <button
                        className={isVisible ? styles.isSelected : ''}
                        type="button"
                        key={item.id}
                        aria-pressed={isVisible}
                        aria-label={`${item.label}: ${formatLegendValue(latestValue, item.unit)}. ${isVisible ? 'Visas i diagrammet' : 'Dold i diagrammet'}`}
                        onClick={() => {
                          if (longPressTriggered.current) {
                            longPressTriggered.current = false;
                            return;
                          }
                          setVisibleSeries((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openSeriesContextMenu(item.id, event.currentTarget, event.clientX, event.clientY);
                        }}
                        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                          event.preventDefault();
                          const bounds = event.currentTarget.getBoundingClientRect();
                          openSeriesContextMenu(item.id, event.currentTarget, bounds.left, bounds.bottom);
                        }}
                        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
                          if (event.pointerType !== 'touch' || !event.isPrimary) return;
                          cancelLongPress(true);
                          const origin = { x: event.clientX, y: event.clientY };
                          const trigger = event.currentTarget;
                          longPressOrigin.current = origin;
                          longPressTimer.current = window.setTimeout(() => {
                            longPressTimer.current = null;
                            longPressTriggered.current = true;
                            openSeriesContextMenu(item.id, trigger, origin.x, origin.y + 8);
                          }, 550);
                        }}
                        onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
                          const origin = longPressOrigin.current;
                          if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) cancelLongPress();
                        }}
                        onPointerUp={() => {
                          const wasLongPress = longPressTriggered.current;
                          cancelLongPress();
                          if (wasLongPress) window.setTimeout(() => { longPressTriggered.current = false; }, 0);
                        }}
                        onPointerCancel={() => cancelLongPress(true)}
                      >
                        <span className={styles.historySeriesDot} style={{ backgroundColor: isVisible ? item.color : '#737b89' }} />
                        <span className={styles.historySeriesLabel}>{item.label}</span>
                        <strong>{formatLegendValue(latestValue, item.unit)}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {history.length > 0 && <p className="dashboard-live-note">{history.length} mätningar och händelser · varje mätserie har en egen skala.</p>}
        </div>
      </div>
      </div>
      {seriesContextMenu && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.seriesContextMenu}
          ref={contextMenuRef}
          role="menu"
          aria-label={`${series.find(({ id }) => id === seriesContextMenu.seriesId)?.label ?? 'Series'} actions`}
          style={{ left: seriesContextMenu.left, top: seriesContextMenu.top }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            ref={contextMenuActionRef}
            className={styles.menuAction}
            type="button"
            role="menuitem"
            onClick={() => {
              setVisibleSeries([seriesContextMenu.seriesId]);
              setSeriesContextMenu(null);
              requestAnimationFrame(() => contextMenuTriggerRef.current?.focus());
            }}
          >{electroluxMenuCopy.isolate}</button>
          <button
            className={styles.menuAction}
            type="button"
            role="menuitem"
            onClick={() => {
              setVisibleSeries(series.map(({ id }) => id));
              setSeriesContextMenu(null);
              requestAnimationFrame(() => contextMenuTriggerRef.current?.focus());
            }}
          >{electroluxMenuCopy.displayAll}</button>
        </div>,
        document.body,
      )}
    </section>
  );
}
