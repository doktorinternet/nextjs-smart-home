import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  ControlAuthConfigError,
  isControlSessionValid,
} from '@/app/lib/control-auth';
import { SpotifyAuthConfigError } from '@/app/lib/spotify-auth';
import { SpotifyPlayerError } from '@/app/lib/spotify-player';

const noStore = { 'Cache-Control': 'no-store' };

export class InvalidPlayerRequestError extends Error {
  constructor() {
    super('Invalid Spotify player request');
    this.name = 'InvalidPlayerRequestError';
  }
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidPlayerRequestError) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }
  if (error instanceof ControlAuthConfigError || error instanceof SpotifyAuthConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503, headers: noStore });
  }
  if (error instanceof SpotifyPlayerError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
  }
  return NextResponse.json({ error: 'Unable to complete Spotify player request' }, {
    status: 502,
    headers: noStore,
  });
}

export async function runPlayerRead(read: () => Promise<unknown | null>): Promise<NextResponse> {
  try {
    return NextResponse.json(await read(), { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function runPlayerControl(
  request: NextRequest,
  action: () => Promise<void>,
): Promise<NextResponse> {
  try {
    if (!(await isControlSessionValid(request))) {
      return NextResponse.json({ error: 'Control authentication required' }, {
        status: 401,
        headers: noStore,
      });
    }
  } catch (error) {
    if (error instanceof ControlAuthConfigError) return errorResponse(error);
    return NextResponse.json({ error: 'Unable to verify control session' }, {
      status: 401,
      headers: noStore,
    });
  }

  try {
    await action();
    return new NextResponse(null, { status: 204, headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function hasOnlyKeys(body: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(body).every((key) => allowed.includes(key));
}

export function validDeviceId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    !/[\u0000-\u0020\u007f]/.test(value);
}

export function optionalDeviceId(body: Record<string, unknown>): string | undefined | null {
  if (body.deviceId === undefined) return undefined;
  return validDeviceId(body.deviceId) ? body.deviceId : null;
}

export function invalidPlayerRequest(): InvalidPlayerRequestError {
  return new InvalidPlayerRequestError();
}
