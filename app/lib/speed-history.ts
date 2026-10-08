export type SpeedHistoryResult = {
  timestamp: string;
  runStatus: 'Completed' | 'Failed';
  serverId: string | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  expectedDownloadMbps: number | null;
  expectedUploadMbps: number | null;
  downloadStatus: string | null;
  uploadStatus: string | null;
  durationSeconds: number | null;
  downloadElapsedMs: number | null;
  uploadElapsedMs: number | null;
  totalElapsedMs: number | null;
  pingLatencyMs: number | null;
  pingJitterMs: number | null;
  downloadLatencyMs: number | null;
  downloadLatencyJitterMs: number | null;
  uploadLatencyMs: number | null;
  uploadLatencyJitterMs: number | null;
  packetLossPercent: number | null;
};

const numericFields = {
  downloadMbps: 'download_mbps',
  uploadMbps: 'upload_mbps',
  expectedDownloadMbps: 'expected_download_mbps',
  expectedUploadMbps: 'expected_upload_mbps',
  durationSeconds: 'duration_seconds',
  downloadElapsedMs: 'download_elapsed_ms',
  uploadElapsedMs: 'upload_elapsed_ms',
  totalElapsedMs: 'total_elapsed_ms',
  pingLatencyMs: 'ping_latency_ms',
  pingJitterMs: 'ping_jitter_ms',
  downloadLatencyMs: 'download_latency_iqm_ms',
  downloadLatencyJitterMs: 'download_latency_jitter_ms',
  uploadLatencyMs: 'upload_latency_iqm_ms',
  uploadLatencyJitterMs: 'upload_latency_jitter_ms',
  packetLossPercent: 'packet_loss_percent',
} as const;

/** Parse the PowerShell Export-Csv format used by checkNetwork.ps1. */
export function parseSpeedHistoryCsv(csv: string): SpeedHistoryResult[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  const timestampIndex = headers.indexOf('timestamp_utc');
  const statusIndex = headers.indexOf('run_status');
  if (timestampIndex < 0 || statusIndex < 0) {
    throw new Error('CSV is missing required columns');
  }

  return rows.slice(1).filter((row) => row.some((value) => value !== '')).map((row) => {
    if (row.length !== headers.length) throw new Error('CSV contains an invalid row');
    const value = (header: string): string => {
      const index = headers.indexOf(header);
      return index < 0 ? '' : (row[index] ?? '').trim();
    };
    const rawTimestamp = row[timestampIndex]?.trim() ?? '';
    const timestampMs = Date.parse(rawTimestamp);
    const runStatus = row[statusIndex]?.trim();
    if (!Number.isFinite(timestampMs) || (runStatus !== 'Completed' && runStatus !== 'Failed')) {
      throw new Error('CSV contains an invalid speed test row');
    }

    const result: SpeedHistoryResult = {
      timestamp: new Date(timestampMs).toISOString(),
      runStatus,
      serverId: value('server_id') || null,
      downloadStatus: value('download_status') || null,
      uploadStatus: value('upload_status') || null,
      ...Object.fromEntries(
        Object.entries(numericFields).map(([key, header]) => [key, parseFiniteNumber(value(header))]),
      ),
    } as SpeedHistoryResult;
    return result;
  });
}

function parseFiniteNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      if (field.length !== 0) throw new Error('CSV contains invalid quoting');
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
