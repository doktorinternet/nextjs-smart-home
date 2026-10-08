import { NextResponse } from 'next/server';
import { ElectroluxApiError, ElectroluxConfigError, getElectroluxStatus } from '@/app/lib/electrolux';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStore = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    return NextResponse.json(await getElectroluxStatus(), { headers: noStore });
  } catch (error) {
    if (error instanceof ElectroluxConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503, headers: noStore });
    }
    if (error instanceof ElectroluxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    }
    return NextResponse.json({ error: 'Electrolux service is unavailable' }, { status: 502, headers: noStore });
  }
}
