import { NextResponse } from 'next/server';
import {
  asRecord,
  getOctoPrintConnection,
  getOctoPrintJob,
  getOctoPrintPrinter,
  OctoPrintError,
} from '@/app/lib/octoprint';
import { saveTelemetryRecords } from '@/app/lib/telemetry';
import { buildPrinterTelemetryRecords } from '@/app/lib/printer-telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [connectionResult, jobResult, printerResult] = await Promise.all([
      getOctoPrintConnection(),
      getOctoPrintJob(),
      getOctoPrintPrinter().catch((error: unknown) => {
        // OctoPrint may return 409 when the printer is not operational; keep
        // the connection/job status useful and simply omit unavailable temps.
        if (error instanceof OctoPrintError && error.status === 409) return null;
        throw error;
      }),
    ]);
    const current = asRecord(asRecord(connectionResult)?.current);
    const job = asRecord(jobResult);
    const printer = asRecord(printerResult);
    const observedAt = new Date().toISOString();
    const connectionState = typeof current?.state === 'string' ? current.state : 'Unknown';
    const jobState = typeof job?.state === 'string' ? job.state : 'Unknown';
    saveTelemetryRecords(buildPrinterTelemetryRecords(connectionResult, jobResult, printerResult, observedAt));

    return NextResponse.json({
      connection: {
        state: connectionState,
      },
      job: {
        state: jobState,
        details: asRecord(job?.job) ?? null,
        progress: asRecord(job?.progress) ?? null,
      },
      printer: { state: asRecord(printer?.state)?.text ?? null },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof OctoPrintError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load printer status' }, { status: 502 });
  }
}
