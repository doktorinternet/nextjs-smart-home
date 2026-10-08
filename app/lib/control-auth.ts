import 'server-only';

import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'control_session';
const SESSION_SECONDS = 15 * 60;
const HASH_PATTERN = /^scrypt\$([A-Za-z0-9_-]{16,})\$([A-Za-z0-9_-]{43})$/;

type ControlAuthConfig = {
  salt: Buffer;
  digest: Buffer;
  secret: Uint8Array;
};

export class ControlAuthConfigError extends Error {
  constructor() {
    super('Control authentication is not configured');
    this.name = 'ControlAuthConfigError';
  }
}

function getConfig(): ControlAuthConfig {
  const pinHash = process.env.CONTROL_PIN_HASH?.trim();
  const rawSecret = process.env.CONTROL_AUTH_SECRET;

  if (!pinHash || !rawSecret) {
    throw new ControlAuthConfigError();
  }

  const parsedHash = HASH_PATTERN.exec(pinHash);
  const secret = new TextEncoder().encode(rawSecret);
  if (!parsedHash || secret.byteLength < 32) {
    throw new ControlAuthConfigError();
  }

  try {
    const salt = Buffer.from(parsedHash[1], 'base64url');
    const digest = Buffer.from(parsedHash[2], 'base64url');
    if (salt.length < 12 || digest.length !== 32) {
      throw new Error('Invalid PIN hash');
    }
    return { salt, digest, secret };
  } catch {
    throw new ControlAuthConfigError();
  }
}

export async function verifyControlPin(pin: string): Promise<boolean> {
  const { salt, digest } = getConfig();
  if (pin.length > 128) return false;

  const candidate = (await scrypt(pin, salt, digest.length)) as Buffer;
  return timingSafeEqual(candidate, digest);
}

export function getControlSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api',
    maxAge: SESSION_SECONDS,
  };
}

export async function createControlSession(): Promise<string> {
  const { secret } = getConfig();
  return new SignJWT({ scope: 'device-control' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret);
}

export async function isControlSessionValid(request: NextRequest): Promise<boolean> {
  const { secret } = getConfig();
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload.scope === 'device-control';
  } catch {
    return false;
  }
}
