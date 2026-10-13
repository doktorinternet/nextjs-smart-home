export type AirMetricDefinition = {
  id: string;
  label: string;
  keys: string[];
  unit: string;
  kind: 'measurement' | 'state';
  color: string;
};

export const airMetricDefinitions: AirMetricDefinition[] = [
  { id: 'air.pm1', label: 'PM1.0', keys: ['pm1', 'pm1_0', 'pm1.0', 'pm1value'], unit: '\u00B5g/m\u00B3', kind: 'measurement', color: '#a78bfa' },
  { id: 'air.pm25', label: 'PM2.5', keys: ['pm25', 'pm2_5', 'pm2.5', 'pm2_5value'], unit: '\u00B5g/m\u00B3', kind: 'measurement', color: '#7dd3fc' },
  { id: 'air.pm10', label: 'PM10', keys: ['pm10', 'pm10value'], unit: '\u00B5g/m\u00B3', kind: 'measurement', color: '#34d399' },
  { id: 'air.tvoc', label: 'TVOC', keys: ['tvoc', 'tvocvalue'], unit: 'ppb', kind: 'measurement', color: '#fb7185' },
  { id: 'air.temperature', label: 'Temperatur', keys: ['temperature', 'roomtemperature', 'temp'], unit: '\u00B0C', kind: 'measurement', color: '#fbbf24' },
  { id: 'air.humidity', label: 'Luftfuktighet', keys: ['humidity', 'relativehumidity'], unit: '%', kind: 'measurement', color: '#60a5fa' },
  { id: 'air.filter_life', label: 'Filterlivsl\u00E4ngd', keys: ['filterlife', 'filterremaining', 'filterremaininglife'], unit: '%', kind: 'measurement', color: '#c4b5fd' },
  { id: 'air.fan_speed', label: 'Fl\u00E4kthastighet', keys: ['fanspeed', 'fanlevel'], unit: '', kind: 'measurement', color: '#f97316' },
  { id: 'air.mode', label: 'L\u00E4ge', keys: ['mode', 'operationmode', 'purifiermode', 'workmode'], unit: '', kind: 'state', color: '#38bdf8' },
];

export const printerMetricDefinitions = [
  { id: 'printer.tool0.actual', label: 'Hotend (\u00B0C)', unit: '\u00B0C', color: '#fbbf24', kind: 'measurement' as const },
  { id: 'printer.bed.actual', label: 'B\u00E4dd (\u00B0C)', unit: '\u00B0C', color: '#c4b5fd', kind: 'measurement' as const },
  { id: 'printer.job-state', label: 'Skrivarstatus', unit: '', color: '#86efac', kind: 'state' as const },
  { id: 'printer.connection-state', label: 'Anslutning', unit: '', color: '#fda4af', kind: 'state' as const },
];
