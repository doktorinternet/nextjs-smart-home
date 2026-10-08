import { NextResponse } from 'next/server';
import { CastBridgeError, getCastDevices } from '@/app/lib/cast-bridge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const devices = await getCastDevices();
    return NextResponse.json({ devices }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CastBridgeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Cast bridge is unavailable' }, { status: 502 });
  }
}
