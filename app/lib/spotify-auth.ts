import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';

const stateCookieName = 'spotify_auth_state';
const stateLifetimeSeconds = 10 * 60;
const tokenEndpoint = 'https://accounts.spotify.com/api/token';
const authorizationEndpoint = 'https://accounts.spotify.com/authorize';

type SpotifyConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
  tokenStorePath: string;
};

type StoredRefreshToken = { refreshToken: string; storedAt: string };

export class SpotifyAuthConfigError extends Error {
  constructor() {
    super('Spotify authorization is not configured');
    this.name = 'SpotifyAuthConfigError';
  }
}

function getConfig(): SpotifyConfig {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();
  const encryptionSecret = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY?.trim();
  const tokenStorePath = process.env.SPOTIFY_TOKEN_STORE_PATH?.trim();

  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret || !tokenStorePath) {
    throw new SpotifyAuthConfigError();
  }

  try {
    const uri = new URL(redirectUri);
    if (
      uri.protocol !== 'https:' &&
      !(uri.protocol === 'http:' && (uri.hostname === '127.0.0.1' || uri.hostname === '[::1]'))
    ) {
      throw new Error('Redirect URI must use HTTPS or a loopback address');
    }
    if (uri.username || uri.password || uri.search || uri.hash || !isAbsolute(tokenStorePath)) {
      throw new Error('Invalid Spotify redirect URI or token store path');
    }

    const encryptionKey = Buffer.from(encryptionSecret, 'base64url');
    if (encryptionKey.length !== 32 || encryptionKey.toString('base64url') !== encryptionSecret) {
      throw new Error('Encryption key must be 32 bytes encoded as base64url');
    }

    return { clientId, clientSecret, redirectUri, encryptionKey, tokenStorePath };
  } catch {
    throw new SpotifyAuthConfigError();
  }
}

export function assertSpotifyAuthConfigured(): void {
  getConfig();
}

export function getSpotifyPostAuthUrl(): URL {
  const config = getConfig();
  return new URL('/dashboard?spotify=connected', new URL(config.redirectUri).origin);
}

export function getSpotifyStateCookieOptions() {
  return {
    name: stateCookieName,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/spotify/auth',
    maxAge: stateLifetimeSeconds,
  };
}

function stateSignature(state: string, key: Buffer): Buffer {
  return createHmac('sha256', key).update(state).digest();
}

export function createSpotifyAuthorizationRequest() {
  const config = getConfig();
  const state = randomBytes(32).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${issuedAt}.${state}`;
  const signedState = `${signedPayload}.${stateSignature(signedPayload, config.encryptionKey).toString('base64url')}`;
  const url = new URL(authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: 'user-read-playback-state user-modify-playback-state',
    state,
  }).toString();
  return { url: url.toString(), signedState };
}

export function verifySpotifyState(signedState: string | undefined, receivedState: string | null): boolean {
  if (!signedState || !receivedState) return false;
  const parts = signedState.split('.');
  if (parts.length !== 3) return false;

  try {
    const config = getConfig();
    const [issuedAtText, cookieState, signatureText] = parts;
    const issuedAt = Number(issuedAtText);
    const age = Math.floor(Date.now() / 1000) - issuedAt;
    if (!Number.isSafeInteger(issuedAt) || age < 0 || age > stateLifetimeSeconds) return false;
    const signedPayload = `${issuedAtText}.${cookieState}`;
    const signature = Buffer.from(signatureText, 'base64url');
    const expected = stateSignature(signedPayload, config.encryptionKey);
    const received = Buffer.from(receivedState);
    const expectedState = Buffer.from(cookieState);
    return (
      signature.length === expected.length &&
      received.length === expectedState.length &&
      timingSafeEqual(signature, expected) &&
      timingSafeEqual(received, expectedState)
    );
  } catch {
    return false;
  }
}

function encryptRefreshToken(refreshToken: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptRefreshToken(envelope: string, key: Buffer): string {
  const [version, ivText, tagText, ciphertextText, extra] = envelope.trim().split('.');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText || extra !== undefined) {
    throw new Error('Stored Spotify credentials are invalid');
  }

  const iv = Buffer.from(ivText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  const ciphertext = Buffer.from(ciphertextText, 'base64url');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Stored Spotify credentials are invalid');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function storeRefreshToken(refreshToken: string, config: SpotifyConfig): Promise<void> {
  const directory = dirname(config.tokenStorePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const contents = JSON.stringify({
    refreshToken: encryptRefreshToken(refreshToken, config.encryptionKey),
    storedAt: new Date().toISOString(),
  } satisfies StoredRefreshToken);
  const temporaryPath = `${config.tokenStorePath}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporaryPath, config.tokenStorePath);
  } catch (error) {
    const { unlink } = await import('node:fs/promises');
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function loadRefreshToken(config: SpotifyConfig): Promise<string> {
  const contents = await readFile(config.tokenStorePath, 'utf8');
  const stored: unknown = JSON.parse(contents);
  if (
    typeof stored !== 'object' || stored === null ||
    !('refreshToken' in stored) || typeof stored.refreshToken !== 'string'
  ) {
    throw new Error('Stored Spotify credentials are invalid');
  }
  return decryptRefreshToken(stored.refreshToken, config.encryptionKey);
}

async function postTokenRequest(body: URLSearchParams, config: SpotifyConfig): Promise<Record<string, unknown>> {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Spotify token request failed');
  const result: unknown = await response.json();
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new Error('Spotify token response is invalid');
  }
  return result as Record<string, unknown>;
}

export async function exchangeSpotifyAuthorizationCode(code: string): Promise<void> {
  const config = getConfig();
  const result = await postTokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  }), config);
  if (typeof result.refresh_token !== 'string' || !result.refresh_token) {
    throw new Error('Spotify did not return a refresh token');
  }
  await storeRefreshToken(result.refresh_token, config);
}

/** Returns an access token for server-side callers only; routes must never serialize it. */
export async function refreshSpotifyAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const config = getConfig();
  const oldRefreshToken = await loadRefreshToken(config);
  const result = await postTokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: oldRefreshToken,
  }), config);
  if (typeof result.access_token !== 'string' || !result.access_token) {
    throw new Error('Spotify did not return an access token');
  }

  if (typeof result.refresh_token === 'string' && result.refresh_token) {
    await storeRefreshToken(result.refresh_token, config);
  }

  return {
    accessToken: result.access_token,
    expiresIn: typeof result.expires_in === 'number' ? result.expires_in : 3600,
  };
}
