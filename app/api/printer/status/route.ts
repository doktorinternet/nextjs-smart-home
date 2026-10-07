import { NextResponse } from 'next/server';
import {
  asRecord,
  getOctoPrintConnection,
  getOctoPrintJob,
  OctoPrintError,
} from '@/app/lib/octoprint';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [connectionResult, jobResult] = await Promise.all([
      getOctoPrintConnection(),
      getOctoPrintJob(),
    ]);
    const current = asRecord(asRecord(connectionResult)?.current);
    const job = asRecord(jobResult);

    return NextResponse.json({
      connection: {
        state: typeof current?.state === 'string' ? current.state : 'Unknown',
      },
      job: {
        state: typeof job?.state === 'string' ? job.state : 'Unknown',
        details: asRecord(job?.job) ?? null,
        progress: asRecord(job?.progress) ?? null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof OctoPrintError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load printer status' }, { status: 502 });
  }
}
