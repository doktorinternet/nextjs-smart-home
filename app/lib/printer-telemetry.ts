import type { TelemetryRecord } from './telemetry';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function buildPrinterTelemetryRecords(
  connectionResult: unknown,
  jobResult: unknown,
  printerResult: unknown,
  observedAt: string,
  sourceId = 'octoprint',
): TelemetryRecord[] {
  const current = asRecord(asRecord(connectionResult)?.current);
  const job = asRecord(jobResult);
  const temperature = asRecord(asRecord(printerResult)?.temperature);
  const records: TelemetryRecord[] = [
    { kind: 'event', sourceId, eventType: 'connection-state', eventValue: typeof current?.state === 'string' ? current.state : 'Unknown', observedAt },
    { kind: 'event', sourceId, eventType: 'job-state', eventValue: typeof job?.state === 'string' ? job.state : 'Unknown', observedAt },
  ];
  for (const [toolId, metricId] of [['tool0', 'printer.tool0.actual'], ['bed', 'printer.bed.actual']]) {
    const actual = asRecord(temperature?.[toolId])?.actual;
    if (typeof actual === 'number' && Number.isFinite(actual)) {
      records.push({ kind: 'measurement', sourceId, metricId, value: actual, unit: '°C', observedAt });
    }
  }
  return records;
}
