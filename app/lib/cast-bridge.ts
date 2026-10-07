import 'server-only';

const MAX_SEEK_SECONDS = 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 5_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CastCommand =
  | { command: 'play' }
  | { command: 'pause' }
  | { command: 'stop' }
  | { command: 'seek'; seconds: number }
  | { command: 'volume'; level: number };

export type CastDevice = {
  id: string;
  name: string;
  model: string | null;
  type: string | null;
};

export class CastBridgeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'CastBridgeError';
  }
}

function getBridgeConfig() {
  const rawUrl = process.env.CAST_BRIDGE_URL?.trim();
  const token = process.env.CAST_BRIDGE_TOKEN?.trim();
  if (!rawUrl || !token || token.length < 32) {
    throw new CastBridgeError('Cast bridge is not configured', 503);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CastBridgeError('Cast bridge is not configured', 503);
  }

  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (
    url.protocol !== 'http:' ||
    !isLoopback ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new CastBridgeError('Cast bridge is not configured', 503);
  }

  return { baseUrl: url.origin, token };
}

function bridgeUrl(path: string): { url: string; token: string } {
  const { baseUrl, token } = getBridgeConfig();
  return { url: new URL(path, `${baseUrl}/`).toString(), token };
}

async function bridgeRequest(path: string, init?: RequestInit): Promise<Response> {
  const { url, token } = bridgeUrl(path);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CastBridgeError('Cast bridge is unavailable', 502);
  }
}

async function checkResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    if (response.status === 404) {
      throw new CastBridgeError('Cast device was not found', 404);
    }
    if (response.status === 400 || response.status === 413) {
      throw new CastBridgeError('Cast bridge rejected the request', response.status);
    }
    throw new CastBridgeError('Cast bridge is unavailable', 502);
  }

  try {
    return await response.json();
  } catch {
    throw new CastBridgeError('Cast bridge returned an invalid response', 502);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' ? value.slice(0, 200) : null;
}

export function isCastDeviceId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseCastCommand(value: unknown): CastCommand | null {
  const body = asRecord(value);
  if (!body || typeof body.command !== 'string') return null;

  if (['play', 'pause', 'stop'].includes(body.command)) {
    if (Object.keys(body).length !== 1) return null;
    return { command: body.command as 'play' | 'pause' | 'stop' };
  }

  if (body.command === 'seek') {
    if (
      Object.keys(body).length !== 2 ||
      typeof body.seconds !== 'number' ||
      !Number.isFinite(body.seconds) ||
      body.seconds < 0 ||
      body.seconds > MAX_SEEK_SECONDS
    ) return null;
    return { command: 'seek', seconds: body.seconds };
  }

  if (body.command === 'volume') {
    if (
      Object.keys(body).length !== 2 ||
      typeof body.level !== 'number' ||
      !Number.isFinite(body.level) ||
      body.level < 0 ||
      body.level > 1
    ) return null;
    return { command: 'volume', level: body.level };
  }

  return null;
}

export async function getCastDevices(): Promise<CastDevice[]> {
  const response = await bridgeRequest('/devices');
  const payload = asRecord(await checkResponse(response));
  if (!payload || !Array.isArray(payload.devices)) {
    throw new CastBridgeError('Cast bridge returned an invalid response', 502);
  }

  const devices: CastDevice[] = [];
  for (const item of payload.devices) {
    const device = asRecord(item);
    if (!device || typeof device.id !== 'string' || !isCastDeviceId(device.id)) {
      throw new CastBridgeError('Cast bridge returned an invalid response', 502);
    }
    devices.push({
      id: device.id.toLowerCase(),
      name: optionalText(device.name) ?? 'Chromecast',
      model: optionalText(device.model),
      type: optionalText(device.type),
    });
  }
  return devices;
}

export async function sendCastCommand(deviceId: string, command: CastCommand): Promise<void> {
  const response = await bridgeRequest(
    `/devices/${encodeURIComponent(deviceId.toLowerCase())}/commands`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    },
  );
  const payload = asRecord(await checkResponse(response));
  if (!payload || payload.ok !== true) {
    throw new CastBridgeError('Cast bridge returned an invalid response', 502);
  }
}
