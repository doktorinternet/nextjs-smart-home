import { NextRequest, NextResponse } from 'next/server';
import {
  CastBridgeError,
  isCastDeviceId,
  parseCastCommand,
  sendCastCommand,
} from '@/app/lib/cast-bridge';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  if (!isCastDeviceId(params.deviceId)) {
    return NextResponse.json({ error: 'Invalid Cast device id' }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 1024) {
    return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  if (new TextEncoder().encode(rawBody).byteLength > 1024) {
    return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const command = parseCastCommand(body);
  if (!command) {
    return NextResponse.json(
      { error: 'Command must be play, pause, stop, seek, or volume with valid parameters' },
      { status: 400 },
    );
  }

  try {
    await sendCastCommand(params.deviceId, command);
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CastBridgeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to send Cast command' }, { status: 502 });
  }
}
