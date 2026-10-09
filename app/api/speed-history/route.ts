import { readFile, stat } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { parseSpeedHistoryCsv } from '@/app/lib/speed-history';
import conf from '@/app/configuration.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const maxCsvBytes = 5 * 1024 * 1024;
const defaultLimit = 30;
const maxLimit = 100;

function unavailable(message: string, status: number) {
  return NextResponse.json(
    { status: 'unavailable', error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: Request) {
  const csvPath = conf.API["Speed-history-path"];
  if (!csvPath) {
    return unavailable('Speed history is not configured', 503);
  }

  let csv: string;
  try {
    const file = await stat(csvPath);
    if (!file.isFile()) return unavailable('Speed history is unavailable', 503);
    if (file.size > maxCsvBytes) return unavailable('Speed history file is too large', 413);
    csv = await readFile(csvPath, 'utf8');
  } catch {
    return unavailable('Speed history is unavailable', 503);
  }

  try {
    const results = parseSpeedHistoryCsv(csv).sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit'));
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, maxLimit)
      : defaultLimit;

    return NextResponse.json(
      { status: 'available', results: results.slice(0, limit) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Failed to parse speed history CSV', error);
    return unavailable('Speed history data is invalid', 502);
  }
}
