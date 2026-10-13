import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'smart-home-telemetry-'));
process.env.TELEMETRY_DATABASE_PATH = join(directory, 'history.sqlite');
const { closeTelemetryDatabase, getTelemetryHistory, saveTelemetryRecords } = await import('../app/lib/telemetry.ts');
const { buildPrinterTelemetryRecords } = await import('../app/lib/printer-telemetry.ts');
const { airMetricDefinitions, printerMetricDefinitions } = await import('../app/lib/air-metrics.ts');
const printerFixture = JSON.parse(readFileSync(new URL('./fixtures/octoprint-status.json', import.meta.url), 'utf8'));

try {
  assert.deepEqual(airMetricDefinitions.map(({ id }) => id), ['air.pm1', 'air.pm25', 'air.pm10', 'air.tvoc', 'air.temperature', 'air.humidity', 'air.filter_life', 'air.fan_speed', 'air.mode']);
  assert.deepEqual(printerMetricDefinitions.map(({ id }) => id), ['printer.tool0.actual', 'printer.bed.actual', 'printer.job-state', 'printer.connection-state']);
  const inserted = saveTelemetryRecords([
    { kind: 'measurement', sourceId: 'pure-a9-1', metricId: 'air.pm25', value: 4.25, unit: 'µg/m³', observedAt: '2026-10-10T12:00:00.000Z' },
    { kind: 'measurement', sourceId: 'pure-a9-1', metricId: 'air.pm25', value: 5, unit: 'µg/m³', observedAt: '2026-10-10T12:01:00.000Z' },
    { kind: 'event', sourceId: 'printer-1', eventType: 'job-state', eventValue: 'Printing', observedAt: '2026-10-10T12:02:00.000Z' },
    { kind: 'event', sourceId: 'printer-1', eventType: 'job-state', eventValue: 'printing', observedAt: '2026-10-10T12:02:10.000Z' },
    { kind: 'event', sourceId: 'printer-1', eventType: 'job-state', eventValue: 'Paused', observedAt: '2026-10-10T12:03:00.000Z' },
    { kind: 'event', sourceId: 'printer-1', eventType: 'job-state', eventValue: 'Printing', observedAt: '2026-10-10T12:04:00.000Z' },
    { kind: 'event', sourceId: 'printer-1', eventType: 'job-state', eventValue: 'Operational', observedAt: '2026-10-10T12:05:00.000Z' },
  ]);

  assert.equal(inserted, 8);
  assert.deepEqual(getTelemetryHistory({ sourceId: 'pure-a9-1', metricId: 'air.pm25', limit: 1 }).map(({ value }) => value), [5]);
  assert.equal(getTelemetryHistory({ sourceId: 'printer-1' }).length, 0);
  const printerEvents = getTelemetryHistory({ sourceId: 'printer-1', kind: 'event' });
  assert.deepEqual(printerEvents.filter(({ eventType }) => ['started', 'stopped'].includes(eventType)).map(({ eventType }) => eventType), ['stopped', 'started']);
  assert.equal(getTelemetryHistory({ sourceId: 'printer-1', kind: 'all' }).length, 6);

  const denseHistory = Array.from({ length: 1300 }, (_, index) => ({
    kind: 'measurement', sourceId: 'dense-printer', metricId: 'printer.tool0.actual',
    value: index === 0 ? 200 : 200 + (index % 2), unit: '°C',
    observedAt: new Date(Date.parse('2026-10-09T12:00:00.000Z') + index * 60_000).toISOString(),
  }));
  denseHistory.push({ kind: 'measurement', sourceId: 'dense-printer', metricId: 'printer.tool0.actual', value: 220, unit: '°C', observedAt: '2026-10-09T12:00:30.000Z' });
  saveTelemetryRecords(denseHistory);
  const downsampled = getTelemetryHistory({ sourceId: 'dense-printer', metricId: 'printer.tool0.actual', from: '2026-10-09T12:00:00.000Z', to: '2026-10-10T12:00:00.000Z', limit: 1500, bucket: 'minute' });
  assert.equal(downsampled.length, 1300);
  assert.equal(downsampled.find(({ observedAt }) => observedAt === '2026-10-09T12:00:00.000Z')?.value, 210);
  assert.equal(getTelemetryHistory({ sourceId: 'dense-printer', metricId: 'printer.tool0.actual', limit: 1500 }).length, 1000);

  saveTelemetryRecords([
    { kind: 'measurement', sourceId: 'bucket-test', metricId: 'air.pm25', value: 2, unit: 'µg/m³', observedAt: '2026-10-10T10:01:00.000Z' },
    { kind: 'measurement', sourceId: 'bucket-test', metricId: 'air.pm25', value: 4, unit: 'µg/m³', observedAt: '2026-10-10T10:08:00.000Z' },
    { kind: 'measurement', sourceId: 'bucket-test', metricId: 'air.pm25', value: 8, unit: 'µg/m³', observedAt: '2026-10-10T10:12:00.000Z' },
    { kind: 'measurement', sourceId: 'bucket-test', metricId: 'air.pm25', value: 10, unit: 'µg/m³', observedAt: '2026-10-10T11:05:00.000Z' },
    { kind: 'measurement', sourceId: 'bucket-test', metricId: 'air.pm25', value: 12, unit: 'µg/m³', observedAt: '2026-10-11T12:00:00.000Z' },
  ]);
  const tenMinuteBuckets = getTelemetryHistory({ sourceId: 'bucket-test', metricId: 'air.pm25', bucket: 'ten-minute', limit: 1500 });
  assert.deepEqual(tenMinuteBuckets.map(({ value }) => value), [12, 10, 8, 3]);
  const hourBuckets = getTelemetryHistory({ sourceId: 'bucket-test', metricId: 'air.pm25', bucket: 'hour', limit: 1500 });
  assert.deepEqual(hourBuckets.map(({ value }) => value), [12, 10, 14 / 3]);
  const dayBuckets = getTelemetryHistory({ sourceId: 'bucket-test', metricId: 'air.pm25', bucket: 'day', limit: 1500 });
  assert.deepEqual(dayBuckets.map(({ value }) => value), [12, 6]);

  saveTelemetryRecords([
    { kind: 'event', sourceId: 'boundary-printer', eventType: 'started', observedAt: '2026-10-09T23:00:00.000Z' },
  ]);
  assert.equal(getTelemetryHistory({ sourceId: 'boundary-printer', kind: 'event', eventType: 'started', from: '2026-10-10T00:00:00.000Z', includeActiveAt: '2026-10-10T00:00:00.000Z' }).length, 1);

  const printerRecords = buildPrinterTelemetryRecords(printerFixture.connection, printerFixture.job, printerFixture.printer, '2026-10-10T13:00:00.000Z');
  assert.deepEqual(printerRecords.filter(({ kind }) => kind === 'measurement').map(({ metricId, value }) => [metricId, value]), [
    ['printer.tool0.actual', 207.5], ['printer.bed.actual', 59.25],
  ]);
  saveTelemetryRecords(printerRecords);
  saveTelemetryRecords(buildPrinterTelemetryRecords(printerFixture.connection, printerFixture.job, printerFixture.printer, '2026-10-10T13:00:15.000Z'));
  saveTelemetryRecords(buildPrinterTelemetryRecords(printerFixture.connection, { state: 'Paused' }, printerFixture.printer, '2026-10-10T13:00:30.000Z'));
  saveTelemetryRecords(buildPrinterTelemetryRecords(printerFixture.connection, { state: 'Operational' }, printerFixture.printer, '2026-10-10T13:01:00.000Z'));
  assert.deepEqual(getTelemetryHistory({ sourceId: 'octoprint', kind: 'event' }).filter(({ eventType }) => ['started', 'stopped'].includes(eventType)).map(({ eventType }) => eventType), ['stopped', 'started']);

  assert.throws(() => saveTelemetryRecords([
    { kind: 'measurement', sourceId: 'pure-a9-1', metricId: 'air.pm25', value: 9, unit: 'µg/m³', observedAt: '2026-10-10T12:03:00.000Z' },
    { kind: 'measurement', sourceId: 'pure-a9-1', metricId: 'air.pm25', value: Number.NaN, unit: 'µg/m³', observedAt: '2026-10-10T12:04:00.000Z' },
  ]), /Invalid telemetry measurement/);
  assert.deepEqual(getTelemetryHistory({ sourceId: 'pure-a9-1', limit: 10 }).map(({ value }) => value), [5, 4.25]);
  console.log('Telemetry storage checks passed.');
} finally {
  closeTelemetryDatabase();
  rmSync(directory, { recursive: true, force: true });
}
