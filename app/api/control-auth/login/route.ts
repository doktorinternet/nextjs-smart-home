import { NextRequest, NextResponse } from 'next/server';
import {
  ControlAuthConfigError,
  createControlSession,
  getControlSessionCookieOptions,
  verifyControlPin,
} from '@/app/lib/control-auth';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    !('pin' in body) ||
    typeof body.pin !== 'string' ||
    Object.keys(body).length !== 1
  ) {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
  }

  try {
    if (!(await verifyControlPin(body.pin))) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const response = NextResponse.json({ authenticated: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
    response.cookies.set({
      ...getControlSessionCookieOptions(),
      value: await createControlSession(),
    });
    return response;
  } catch (error) {
    if (error instanceof ControlAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unable to start control session' }, { status: 500 });
  }
}
