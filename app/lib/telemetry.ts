import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type TelemetryMeasurement = {
  kind: 'measurement';
  sourceId: string;
  metricId: string;
  value: number;
  unit: string;
  observedAt: string;
};

export type TelemetryEvent = {
  kind: 'event';
  sourceId: string;
  eventType: 'state' | 'started' | 'stopped' | string;
  eventValue?: string;
  observedAt: string;
};

export type TelemetryRecord = TelemetryMeasurement | TelemetryEvent;

export type TelemetryHistoryQuery = {
  sourceId?: string;
  metricId?: string;
  kind?: 'measurement' | 'event' | 'all';
  eventType?: string;
  from?: string;
  to?: string;
  limit?: number;
  bucket?: 'minute';
  includeActiveAt?: string;
};

export type StoredTelemetryRecord = TelemetryRecord & { id: number };

type SqliteStatement = {
  run(...values: Array<string | number | null>): unknown;
  all(...values: Array<string | number | null>): Array<Record<string, unknown>>;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const defaultHistoryLimit = 100;
const maxHistoryLimit = 1000;
let database: SqliteDatabase | undefined;

function databasePath(): string {
  const configured = process.env.TELEMETRY_DATABASE_PATH?.trim();
  const path = configured ? resolve(configured) : resolve(process.cwd(), 'data', 'telemetry.sqlite');
  if (configured && !isAbsolute(configured)) throw new Error('TELEMETRY_DATABASE_PATH must be absolute');
  return path;
}

function getDatabase(): SqliteDatabase {
  if (database) return database;
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });
  const opened = new DatabaseSync(path) as unknown as SqliteDatabase;
  opened.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS telemetry_records (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('measurement', 'event')),
      source_id TEXT NOT NULL,
      metric_id TEXT,
      value REAL,
      unit TEXT,
      event_type TEXT,
      event_value TEXT,
      observed_at TEXT NOT NULL,
      CHECK (
        (kind = 'measurement' AND metric_id IS NOT NULL AND value IS NOT NULL AND unit IS NOT NULL AND event_type IS NULL)
        OR (kind = 'event' AND metric_id IS NULL AND value IS NULL AND unit IS NULL AND event_type IS NOT NULL)
      )
    ) STRICT;
    CREATE INDEX IF NOT EXISTS telemetry_measurement_history
      ON telemetry_records (source_id, metric_id, observed_at DESC)
      WHERE kind = 'measurement';
    CREATE INDEX IF NOT EXISTS telemetry_event_history
      ON telemetry_records (source_id, event_type, observed_at DESC)
      WHERE kind = 'event';
  `);
  database = opened;
  return opened;
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function saveTelemetryRecords(records: readonly TelemetryRecord[]): number {
  if (records.length === 0) return 0;
  for (const record of records) {
    if (!record.sourceId.trim() || !validTimestamp(record.observedAt)) throw new Error('Invalid telemetry record');
    if (record.kind === 'measurement' && (!record.metricId.trim() || !Number.isFinite(record.value))) {
      throw new Error('Invalid telemetry measurement');
    }
  }

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO telemetry_records (kind, source_id, metric_id, value, unit, event_type, event_value, observed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const latestEvent = db.prepare(`
    SELECT event_value FROM telemetry_records
    WHERE kind = 'event' AND source_id = ? AND event_type = ?
    ORDER BY observed_at DESC, id DESC LIMIT 1
  `);
  db.exec('BEGIN IMMEDIATE');
  let inserted = 0;
  try {
    for (const record of records) {
      if (record.kind === 'measurement') {
        insert.run('measurement', record.sourceId, record.metricId, record.value, record.unit, null, null, new Date(record.observedAt).toISOString());
      } else {
        if (record.eventType.endsWith('-state')) {
          const previous = latestEvent.all(record.sourceId, record.eventType)[0]?.event_value;
          if (record.eventType === 'job-state') {
            const previousState = typeof previous === 'string' ? previous.trim().toLowerCase() : '';
            const nextState = (record.eventValue ?? '').trim().toLowerCase();
            if (previousState === nextState) continue;
            const wasActive = ['printing', 'paused', 'pausing', 'cancelling'].includes(previousState);
            const isActive = ['printing', 'paused', 'pausing', 'cancelling'].includes(nextState);
            if (!wasActive && isActive) {
              insert.run('event', record.sourceId, null, null, null, 'started', nextState, new Date(record.observedAt).toISOString());
              inserted += 1;
            } else if (wasActive && !isActive) {
              insert.run('event', record.sourceId, null, null, null, 'stopped', nextState, new Date(record.observedAt).toISOString());
              inserted += 1;
            }
          } else if (previous === (record.eventValue ?? null)) continue;
        } else if (record.eventType === 'started' || record.eventType === 'stopped') {
          const previous = db.prepare(`
            SELECT event_type FROM telemetry_records
            WHERE kind = 'event' AND source_id = ? AND event_type IN ('started', 'stopped')
            ORDER BY observed_at DESC, id DESC LIMIT 1
          `).all(record.sourceId)[0]?.event_type;
          if (previous === record.eventType) continue;
        }
        insert.run('event', record.sourceId, null, null, null, record.eventType, record.eventValue ?? null, new Date(record.observedAt).toISOString());
      }
      inserted += 1;
    }
    db.exec('COMMIT');
    return inserted;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function boundedLimit(value: number | undefined, maximum = maxHistoryLimit): number {
  return value === undefined || !Number.isInteger(value) || value < 1
    ? defaultHistoryLimit
    : Math.min(value, maximum);
}

export function getTelemetryHistory(query: TelemetryHistoryQuery = {}): StoredTelemetryRecord[] {
  const clauses: string[] = [];
  const values: Array<string | number | null> = [];
  if (query.kind !== 'all') {
    clauses.push('kind = ?');
    values.push(query.kind ?? 'measurement');
  }
  if (query.sourceId) { clauses.push('source_id = ?'); values.push(query.sourceId); }
  if (query.metricId) { clauses.push('metric_id = ?'); values.push(query.metricId); }
  if (query.eventType) { clauses.push('event_type = ?'); values.push(query.eventType); }
  if (query.from && validTimestamp(query.from)) { clauses.push('observed_at >= ?'); values.push(new Date(query.from).toISOString()); }
  if (query.to && validTimestamp(query.to)) { clauses.push('observed_at <= ?'); values.push(new Date(query.to).toISOString()); }
  const downsample = query.bucket === 'minute' && (query.kind === undefined || query.kind === 'measurement');
  values.push(boundedLimit(query.limit, downsample ? 1500 : maxHistoryLimit));
  const rows = getDatabase().prepare(downsample ? `
    SELECT MIN(id) AS id, kind, source_id, metric_id, AVG(value) AS value, unit, NULL AS event_type, NULL AS event_value,
      strftime('%Y-%m-%dT%H:%M:00.000Z', observed_at) AS observed_at
    FROM telemetry_records ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    GROUP BY source_id, metric_id, unit, strftime('%Y-%m-%dT%H:%M', observed_at)
    ORDER BY observed_at DESC, id DESC LIMIT ?
  ` : `
    SELECT id, kind, source_id, metric_id, value, unit, event_type, event_value, observed_at
    FROM telemetry_records ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY observed_at DESC, id DESC LIMIT ?
  `).all(...values);
  const mapped = rows.map((row) => row.kind === 'measurement' ? ({
    id: Number(row.id), kind: 'measurement' as const, sourceId: String(row.source_id),
    metricId: String(row.metric_id), value: Number(row.value), unit: String(row.unit), observedAt: String(row.observed_at),
  }) : ({
    id: Number(row.id), kind: 'event' as const, sourceId: String(row.source_id),
    eventType: String(row.event_type), ...(row.event_value === null ? {} : { eventValue: String(row.event_value) }), observedAt: String(row.observed_at),
  }));
  if (query.includeActiveAt && query.kind === 'event' && query.eventType === 'started' && validTimestamp(query.includeActiveAt)) {
    const boundary = new Date(query.includeActiveAt).toISOString();
    const priorRows = getDatabase().prepare(`
      WITH transitions AS (
        SELECT id, source_id, event_type, event_value, observed_at,
          ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY observed_at DESC, id DESC) AS rank
        FROM telemetry_records
        WHERE kind = 'event' AND event_type IN ('started', 'stopped') AND observed_at < ?
      )
      SELECT id, source_id, event_value, observed_at FROM transitions WHERE rank = 1 AND event_type = 'started'
    `).all(boundary);
    for (const row of priorRows) mapped.push({
      id: Number(row.id), kind: 'event', sourceId: String(row.source_id), eventType: 'started',
      ...(row.event_value === null ? {} : { eventValue: String(row.event_value) }), observedAt: String(row.observed_at),
    });
  }
  return mapped;
}

/** Close the cached connection; intended for isolated tests and process shutdown. */
export function closeTelemetryDatabase(): void {
  database?.close();
  database = undefined;
}
