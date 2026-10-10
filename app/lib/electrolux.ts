import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';

const apiBase = 'https://api.developer.electrolux.one';
type Config = { apiKey: string; encryptionKey: Buffer; tokenStorePath: string; initialRefreshToken?: string; applianceId?: string };
type Appliance = { id: string; name: string };
export type ElectroluxMetric = { label: string; value: string };
export type ElectroluxStatus = { appliance: string; metrics: ElectroluxMetric[]; updatedAt: string };

export class ElectroluxConfigError extends Error {
  constructor() {
    super('Electrolux telemetry is not configured');
    this.name = 'ElectroluxConfigError';
  }
}

export class ElectroluxApiError extends Error {
  constructor(message = 'Electrolux service is unavailable', readonly status = 502) {
    super(message);
    this.name = 'ElectroluxApiError';
  }
}

type AccessTokenCache = {
  apiKey: string;
  tokenStorePath: string;
  accessToken: string;
  expiresAt: number;
};

let accessTokenCache: AccessTokenCache | null = null;
let accessTokenRefresh: Promise<string> | null = null;

function getConfig(): Config {
  const apiKey = process.env.ELECTROLUX_API_KEY?.trim();
  const encryptionSecret = process.env.ELECTROLUX_TOKEN_ENCRYPTION_KEY?.trim();
  const tokenStorePath = process.env.ELECTROLUX_TOKEN_STORE_PATH?.trim();
  const initialRefreshToken = process.env.ELECTROLUX_REFRESH_TOKEN?.trim();
  const applianceId = process.env.ELECTROLUX_APPLIANCE_ID?.trim();
  if (!apiKey || !encryptionSecret || !tokenStorePath || !isAbsolute(tokenStorePath)) throw new ElectroluxConfigError();

  const encryptionKey = Buffer.from(encryptionSecret, 'base64url');
  if (encryptionKey.length !== 32 || encryptionKey.toString('base64url') !== encryptionSecret) {
    throw new ElectroluxConfigError();
  }
  return { apiKey, encryptionKey, tokenStorePath, initialRefreshToken: initialRefreshToken || undefined, applianceId: applianceId || undefined };
}

function encryptToken(refreshToken: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptToken(envelope: string, key: Buffer): string {
  const [version, ivText, tagText, ciphertextText, extra] = envelope.trim().split('.');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText || extra !== undefined) throw new Error();
  const iv = Buffer.from(ivText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  const ciphertext = Buffer.from(ciphertextText, 'base64url');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function saveRefreshToken(refreshToken: string, config: Config): Promise<void> {
  const directory = dirname(config.tokenStorePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${config.tokenStorePath}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    await writeFile(temporaryPath, encryptToken(refreshToken, config.encryptionKey), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporaryPath, config.tokenStorePath);
  } catch (error) {
    const { unlink } = await import('node:fs/promises');
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function loadRefreshToken(config: Config): Promise<string> {
  try {
    return decryptToken(await readFile(config.tokenStorePath, 'utf8'), config.encryptionKey);
  } catch {
    if (config.initialRefreshToken) {
      await saveRefreshToken(config.initialRefreshToken, config);
      return config.initialRefreshToken;
    }
    throw new ElectroluxConfigError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function request(path: string, config: Config, accessToken?: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'x-api-key': config.apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ElectroluxApiError();
  }
  if (!response.ok) throw new ElectroluxApiError();
  try {
    return await response.json();
  } catch {
    throw new ElectroluxApiError('Electrolux returned an invalid response');
  }
}

function tokenExpiry(accessToken: string, response: Record<string, unknown>): number {
  const expirations: number[] = [];
  const expiresIn = response.expiresIn ?? response.expires_in;
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    expirations.push(Date.now() + expiresIn * 1000);
  }

  const payloadPart = accessToken.split('.')[1];
  if (payloadPart) {
    try {
      const payload: unknown = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
      if (isRecord(payload) && typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
        expirations.push(payload.exp * 1000);
      }
    } catch {
      // Some access tokens are opaque; use the response lifetime or a short fallback below.
    }
  }

  const expiresAt = expirations.length > 0 ? Math.min(...expirations) : Date.now() + 5 * 60_000;
  return Math.max(Date.now(), expiresAt - 45_000);
}

async function refreshAccessToken(config: Config): Promise<string> {
  const refreshToken = await loadRefreshToken(config);
  const result = await request('/api/v1/token/refresh', config, undefined, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!isRecord(result)) throw new ElectroluxApiError('Electrolux returned an invalid token response');
  const accessToken = result.accessToken ?? result.access_token;
  const rotatedRefreshToken = result.refreshToken ?? result.refresh_token;
  if (typeof accessToken !== 'string' || !accessToken) throw new ElectroluxApiError('Electrolux returned an invalid token response');
  if (typeof rotatedRefreshToken === 'string' && rotatedRefreshToken) await saveRefreshToken(rotatedRefreshToken, config);
  accessTokenCache = {
    apiKey: config.apiKey,
    tokenStorePath: config.tokenStorePath,
    accessToken,
    expiresAt: tokenExpiry(accessToken, result),
  };
  return accessToken;
}

async function getAccessToken(config: Config): Promise<string> {
  if (
    accessTokenCache &&
    accessTokenCache.apiKey === config.apiKey &&
    accessTokenCache.tokenStorePath === config.tokenStorePath &&
    accessTokenCache.expiresAt > Date.now()
  ) {
    return accessTokenCache.accessToken;
  }

  if (!accessTokenRefresh) accessTokenRefresh = refreshAccessToken(config);
  try {
    return await accessTokenRefresh;
  } finally {
    accessTokenRefresh = null;
  }
}

function appliancesFrom(value: unknown): Appliance[] {
  const list = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.appliances) ? value.appliances : null;
  if (!list) throw new ElectroluxApiError('Electrolux returned an invalid appliance list');
  return list.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = item.applianceId ?? item.id;
    const applianceData = isRecord(item.applianceData) ? item.applianceData : null;
    const name = item.applianceName ?? applianceData?.applianceName ?? item.name;
    return typeof id === 'string' && id
      ? [{ id, name: typeof name === 'string' && name.trim() ? name : 'Electrolux appliance' }]
      : [];
  });
}

const metricDefinitions: Array<{ label: string; keys: string[]; unit: string }> = [
  { label: 'PM1.0', keys: ['pm1', 'pm1_0', 'pm1.0', 'pm1value'], unit: 'µg/m³' },
  { label: 'PM2.5', keys: ['pm25', 'pm2_5', 'pm2.5', 'pm2_5value'], unit: 'µg/m³' },
  { label: 'PM10', keys: ['pm10', 'pm10value'], unit: 'µg/m³' },
  { label: 'TVOC', keys: ['tvoc', 'tvocvalue'], unit: 'ppb' },
  { label: 'Temperatur', keys: ['temperature', 'roomtemperature'], unit: '°C' },
  { label: 'Luftfuktighet', keys: ['humidity', 'relativehumidity'], unit: '%' },
  { label: 'Filterlivslängd', keys: ['filterlife', 'filterremaining', 'filterremaininglife'], unit: '%' },
  { label: 'Fläkthastighet', keys: ['fanspeed', 'fanlevel'], unit: '' },
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, '');
}

function findValue(value: unknown, keys: string[], depth = 0): unknown {
  if (depth > 8 || !isRecord(value)) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (keys.some((candidate) => normalizeKey(candidate) === normalizeKey(key))) {
      if (isRecord(child) && 'value' in child) return child.value;
      return child;
    }
  }
  for (const child of Object.values(value)) {
    const found = findValue(child, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function displayValue(value: unknown, unit: string): string | undefined {
  const raw = isRecord(value) && 'value' in value ? value.value : value;
  if (typeof raw !== 'number' && typeof raw !== 'string') return undefined;
  if (typeof raw === 'string' && !raw.trim()) return undefined;
  const numeric = typeof raw === 'string' ? Number(raw) : raw;
  const shown = Number.isFinite(numeric) ? `${numeric}${unit ? ` ${unit}` : ''}` : `${raw}${unit ? ` ${unit}` : ''}`;
  return shown.slice(0, 64);
}

export async function getElectroluxStatus(): Promise<ElectroluxStatus> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const appliances = appliancesFrom(await request('/api/v1/appliances', config, accessToken));
  const appliance = config.applianceId
    ? appliances.find((item) => item.id === config.applianceId)
    : appliances[0];
  if (!appliance) throw new ElectroluxApiError('No Electrolux appliance is available', 404);

  const state = await request(`/api/v1/appliances/${encodeURIComponent(appliance.id)}/state`, config, accessToken);
  const metrics = metricDefinitions.flatMap(({ label, keys, unit }) => {
    const value = displayValue(findValue(state, keys), unit);
    return value ? [{ label, value }] : [];
  });
  return { appliance: appliance.name.slice(0, 80), metrics, updatedAt: new Date().toISOString() };
}
