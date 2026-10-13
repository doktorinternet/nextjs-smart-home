import { NextResponse } from 'next/server';
import { getTelemetryHistory } from '@/app/lib/telemetry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStore = { 'Cache-Control': 'no-store' };
const maxParameterLength = 160;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sourceId = params.get('sourceId')?.slice(0, maxParameterLength) || undefined;
  const metricId = params.get('metricId')?.slice(0, maxParameterLength) || undefined;
  const rawKind = params.get('kind');
  if (rawKind && !['measurement', 'event', 'all'].includes(rawKind)) {
    return NextResponse.json({ error: 'kind must be measurement, event, or all' }, { status: 400, headers: noStore });
  }
  const kind = rawKind as 'measurement' | 'event' | 'all' | null;
  const eventType = params.get('eventType')?.slice(0, maxParameterLength) || undefined;
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  const rawBucket = params.get('bucket');
  if (rawBucket && !['minute', 'ten-minute', 'hour', 'day'].includes(rawBucket)) {
    return NextResponse.json({ error: 'bucket must be minute, ten-minute, hour, or day' }, { status: 400, headers: noStore });
  }
  const rawIncludeActiveAt = params.get('includeActiveAt');
  if (rawIncludeActiveAt && !Number.isFinite(Date.parse(rawIncludeActiveAt))) {
    return NextResponse.json({ error: 'Invalid active interval boundary' }, { status: 400, headers: noStore });
  }
  if ((from && !Number.isFinite(Date.parse(from))) || (to && !Number.isFinite(Date.parse(to)))) {
    return NextResponse.json({ error: 'Invalid time range' }, { status: 400, headers: noStore });
  }

  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400, headers: noStore });
  }

  try {
    return NextResponse.json({ records: getTelemetryHistory({ sourceId, metricId, kind: kind ?? undefined, eventType, from, to, limit, bucket: rawBucket as 'minute' | 'ten-minute' | 'hour' | 'day' | undefined, includeActiveAt: rawIncludeActiveAt ?? undefined }) }, { headers: noStore });
  } catch (error) {
    console.error('Failed to read telemetry history', error);
    return NextResponse.json({ error: 'Telemetry history is unavailable' }, { status: 503, headers: noStore });
  }
}
