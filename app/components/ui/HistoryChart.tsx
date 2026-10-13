'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { copy, formatCopy, locale } from '@/app/copy';
import { ChartContainer, ChartTooltipContent } from '@/app/components/ui/chart';
import { useDashboardPanelVisibility } from '@/app/dashboard/DashboardPanelVisibility';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './HistoryChart.module.css';

export type HistoryChartRow = { timestamp: number } & Record<string, number | string>;

export type HistoryChartSeries = {
  id: string;
  label: string;
  unit: string;
  color: string;
  groupId: string;
  groupLabel: string;
  kind?: 'measurement' | 'state';
  scaleId?: string;
  axisLabel?: string;
};

export type HistoryChartRange = { id: string; label: string };

type SeriesContextMenu = { seriesId: string; left: number; top: number };

type HistoryChartProps = {
  data: HistoryChartRow[];
  series: readonly HistoryChartSeries[];
  ranges: readonly HistoryChartRange[];
  selectedRangeId: string;
  onRangeChange: (rangeId: string) => void;
  xDomain: [number, number];
  xTickFormatter: (value: number) => string;
  rangeLabel?: string;
  legendLabel?: string;
  latestValues?: ReadonlyMap<string, string | number>;
  footer?: ReactNode;
};

function scaleIdFor(series: HistoryChartSeries): string {
  if (series.scaleId) return `scale:${series.scaleId}`;
  return series.kind === 'state' ? `state:${series.id}` : `unit:${series.unit || 'value'}`;
}

function formatLegendValue(value: string | number | undefined, unit: string): string {
  if (typeof value === 'number') {
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return value ?? copy.historyChart.noValue;
}

export default function HistoryChart({
  data,
  series,
  ranges,
  selectedRangeId,
  onRangeChange,
  xDomain,
  xTickFormatter,
  rangeLabel = copy.historyChart.rangeLabel,
  legendLabel = copy.historyChart.legendLabel,
  latestValues,
  footer,
}: HistoryChartProps) {
  const panelVisible = useDashboardPanelVisibility();
  const seriesKey = series.map(({ id }) => id).join('\0');
  const seriesIds = seriesKey ? seriesKey.split('\0') : [];
  const [visibleSeries, setVisibleSeries] = useState<string[]>(seriesIds);
  const [seriesContextMenu, setSeriesContextMenu] = useState<SeriesContextMenu | null>(null);
  const previousSeriesIds = useRef(seriesIds);
  const longPressTimer = useRef<number | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuActionRef = useRef<HTMLButtonElement | null>(null);
  const contextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const currentSeriesIds = seriesKey ? seriesKey.split('\0') : [];
    setVisibleSeries((current) => {
      const visible = new Set(current.filter((id) => currentSeriesIds.includes(id)));
      for (const id of currentSeriesIds) {
        if (!previousSeriesIds.current.includes(id)) visible.add(id);
      }
      previousSeriesIds.current = currentSeriesIds;
      return currentSeriesIds.filter((id) => visible.has(id));
    });
  }, [seriesKey]);

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

  const openSeriesContextMenu = (seriesId: string, trigger: HTMLButtonElement, x: number, y: number) => {
    const edge = 8;
    const menuWidth = 208;
    const menuHeight = 192;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || menuWidth + edge * 2;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || menuHeight + edge * 2;
    const requestedLeft = Number.isFinite(x) ? x : trigger.getBoundingClientRect().left;
    const requestedTop = Number.isFinite(y) ? y : trigger.getBoundingClientRect().bottom;
    contextMenuTriggerRef.current = trigger;
    setSeriesContextMenu({
      seriesId,
      left: Math.max(edge, Math.min(requestedLeft, viewportWidth - menuWidth - edge)),
      top: Math.max(edge, Math.min(requestedTop, viewportHeight - menuHeight - edge)),
    });
  };

  const cancelLongPress = (resetTriggered = false) => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressOrigin.current = null;
    if (resetTriggered) longPressTriggered.current = false;
  };

  const chartConfig = Object.fromEntries(series.map(({ id, label, unit, color }) => [id, { label, unit, color }]));
  const groups = [...new Map(series.map(({ groupId, groupLabel }) => [groupId, groupLabel])).entries()];
  const axes = [...new Map(series.map((item) => {
    const id = scaleIdFor(item);
    return [id, { id, label: item.axisLabel ?? (item.unit || item.label), unit: item.unit, kind: item.kind, seriesId: item.id }];
  })).values()];
  const activeSeries = series.find(({ id }) => visibleSeries.includes(id));
  const activeAxisId = activeSeries ? scaleIdFor(activeSeries) : undefined;
  const currentValues = new Map<string, string | number>();
  for (const row of data) {
    for (const item of series) {
      const value = row[item.id];
      if (typeof value === 'number') currentValues.set(item.id, item.kind === 'state' ? String(row[`${item.id}Label`] ?? value) : value);
      else if (typeof value === 'string') currentValues.set(item.id, value);
    }
  }
  for (const [id, value] of latestValues ?? []) currentValues.set(id, value);

  const applyMenuAction = (action: 'isolate' | 'showAll' | 'hideGroup' | 'showGroup') => {
    if (!seriesContextMenu) return;
    const selected = series.find(({ id }) => id === seriesContextMenu.seriesId);
    const groupIds = selected ? series.filter(({ groupId }) => groupId === selected.groupId).map(({ id }) => id) : [];
    if (action === 'isolate') setVisibleSeries([seriesContextMenu.seriesId]);
    else if (action === 'showAll') setVisibleSeries(seriesIds);
    else if (action === 'hideGroup') setVisibleSeries((current) => current.filter((id) => !groupIds.includes(id)));
    else setVisibleSeries((current) => [...new Set([...current, ...groupIds])]);
    setSeriesContextMenu(null);
    requestAnimationFrame(() => contextMenuTriggerRef.current?.focus());
  };

  return (
    <div className={styles.historyChart}>
      <div className={styles.historyRangeTabs} role="group" aria-label={rangeLabel}>
        {ranges.map((range) => (
          <button
            className={selectedRangeId === range.id ? styles.isActive : ''}
            type="button"
            key={range.id}
            aria-pressed={selectedRangeId === range.id}
            onClick={() => onRangeChange(range.id)}
          >{range.label}</button>
        ))}
      </div>
      {panelVisible && <ChartContainer className={styles.historyRecharts} config={chartConfig} initialDimension={{ width: 600, height: 220 }}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.12)" />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={xDomain}
            tickFormatter={xTickFormatter}
          />
          {axes.map((axis) => {
            const isVisible = axis.id === activeAxisId;
            const stateSeries = axis.kind === 'state' ? series.find(({ id }) => id === axis.seriesId) : undefined;
            return (
              <YAxis
                key={axis.id}
                yAxisId={axis.id}
                hide={!isVisible}
                width={isVisible ? 42 : 0}
                tick={isVisible ? { fill: '#bac2ce', fontSize: 10 } : false}
                tickLine={false}
                axisLine={false}
                tickCount={5}
                label={isVisible ? { value: axis.unit && axis.label !== axis.unit ? `${axis.label} (${axis.unit})` : axis.label, angle: -90, position: 'insideLeft', fill: '#bac2ce', fontSize: 10 } : undefined}
                tickFormatter={(value: number) => stateSeries
                  ? String(data.find((row) => row[stateSeries.id] === value)?.[`${stateSeries.id}Label`] ?? '')
                  : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}
                domain={stateSeries ? [0, 'auto'] : ['auto', 'auto']}
              />
            );
          })}
          <Tooltip
            content={<ChartTooltipContent config={chartConfig} />}
            cursor={{ stroke: 'rgba(255,255,255,.45)', strokeDasharray: '3 3' }}
            isAnimationActive={false}
          />
          {series.filter(({ id }) => visibleSeries.includes(id)).map((item) => (
            <Line
              key={item.id}
              type={item.kind === 'state' ? 'stepAfter' : 'monotone'}
              dataKey={item.id}
              name={item.id}
              yAxisId={scaleIdFor(item)}
              stroke={item.color}
              dot={item.kind === 'state'}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>}
      <div className={styles.metricGroups} aria-label={legendLabel}>
        {groups.map(([groupId, groupLabel]) => (
          <section className={styles.metricGroup} key={groupId}>
            <h3>{groupLabel}</h3>
            <div className={styles.metricLegend} role="group" aria-label={groupLabel}>
              {series.filter((item) => item.groupId === groupId).map((item) => {
                const isVisible = visibleSeries.includes(item.id);
                return (
                  <button
                    className={isVisible ? styles.isSelected : ''}
                    type="button"
                    key={item.id}
                    aria-pressed={isVisible}
                    aria-label={formatCopy(copy.historyChart.seriesAria, {
                      label: item.label,
                      value: formatLegendValue(currentValues.get(item.id), item.unit),
                      visibility: isVisible ? copy.historyChart.seriesVisible : copy.historyChart.seriesHidden,
                    })}
                    onClick={() => {
                      if (longPressTriggered.current) {
                        longPressTriggered.current = false;
                        return;
                      }
                      setVisibleSeries((current) => isVisible
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id]);
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
                    <span className={styles.metricDot} style={{ backgroundColor: isVisible ? item.color : '#737b89' }} />
                    <span className={styles.metricLabel}>{item.label}</span>
                    <strong>{formatLegendValue(currentValues.get(item.id), item.unit)}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {footer && <p className="dashboard-live-note">{footer}</p>}
      {seriesContextMenu && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.seriesContextMenu}
          ref={contextMenuRef}
          role="menu"
          aria-label={formatCopy(copy.historyChart.seriesActions, {
            series: series.find(({ id }) => id === seriesContextMenu.seriesId)?.label ?? copy.historyChart.unknownSeries,
          })}
          style={{ left: seriesContextMenu.left, top: seriesContextMenu.top }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button ref={contextMenuActionRef} className={styles.menuAction} type="button" role="menuitem" onClick={() => applyMenuAction('isolate')}>{copy.historyChart.isolateSeries}</button>
          <button className={styles.menuAction} type="button" role="menuitem" onClick={() => applyMenuAction('showAll')}>{copy.historyChart.showAllSeries}</button>
          <button className={styles.menuAction} type="button" role="menuitem" onClick={() => applyMenuAction('hideGroup')}>{copy.historyChart.hideGroup}</button>
          <button className={styles.menuAction} type="button" role="menuitem" onClick={() => applyMenuAction('showGroup')}>{copy.historyChart.showGroup}</button>
        </div>,
        document.body,
      )}
    </div>
  );
}