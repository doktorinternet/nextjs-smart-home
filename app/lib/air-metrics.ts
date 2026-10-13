import { copy } from '@/app/copy';

export type AirMetricDefinition = {
  id: string;
  label: string;
  keys: string[];
  unit: string;
  kind: 'measurement' | 'state';
  color: string;
};

export const airMetricDefinitions: AirMetricDefinition[] = [
  { id: 'air.pm1', label: copy.electroluxMetrics.pm1, keys: ['pm1', 'pm1_0', 'pm1.0', 'pm1value'], unit: '\u00B5g/m\u00B3', kind: 'measurement', color: '#a78bfa' },
  { id: 'air.pm25', label: copy.electroluxMetrics.pm25, keys: ['pm25', 'pm2_5', 'pm2.5', 'pm2_5value'], unit: '\u00B5g/m\u00B3', kind: 'measurement', color: '#7dd3fc' },
  { id: 'air.pm10', label: copy.electroluxMetrics.pm10, keys: ['pm10', 'pm10value'], unit: '\u00B5g/m\u00B3', kind: 'measurement', color: '#34d399' },
  { id: 'air.tvoc', label: copy.electroluxMetrics.tvoc, keys: ['tvoc', 'tvocvalue'], unit: 'ppb', kind: 'measurement', color: '#fb7185' },
  { id: 'air.temperature', label: copy.electroluxMetrics.temperature, keys: ['temperature', 'roomtemperature', 'temp'], unit: '\u00B0C', kind: 'measurement', color: '#fbbf24' },
  { id: 'air.humidity', label: copy.electroluxMetrics.humidity, keys: ['humidity', 'relativehumidity'], unit: '%', kind: 'measurement', color: '#60a5fa' },
  { id: 'air.filter_life', label: copy.electroluxMetrics.filterLife, keys: ['filterlife', 'filterremaining', 'filterremaininglife'], unit: '%', kind: 'measurement', color: '#c4b5fd' },
  { id: 'air.fan_speed', label: copy.electroluxMetrics.fanSpeed, keys: ['fanspeed', 'fanlevel'], unit: '', kind: 'measurement', color: '#f97316' },
  { id: 'air.mode', label: copy.electroluxMetrics.mode, keys: ['mode', 'operationmode', 'purifiermode', 'workmode'], unit: '', kind: 'state', color: '#38bdf8' },
];

export const printerMetricDefinitions = [
  { id: 'printer.tool0.actual', label: copy.printer.metrics.hotend, unit: '\u00B0C', color: '#fbbf24', kind: 'measurement' as const },
  { id: 'printer.bed.actual', label: copy.printer.metrics.bed, unit: '\u00B0C', color: '#c4b5fd', kind: 'measurement' as const },
  { id: 'printer.job-state', label: copy.printer.metrics.jobState, unit: '', color: '#86efac', kind: 'state' as const },
  { id: 'printer.connection-state', label: copy.printer.metrics.connectionState, unit: '', color: '#fda4af', kind: 'state' as const },
];
