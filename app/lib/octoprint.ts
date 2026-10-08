import 'server-only';

export type OctoPrintCommand = 'pause' | 'resume' | 'cancel';

export class OctoPrintError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'OctoPrintError';
  }
}

function getConfig(): { baseUrl: string; apiKey: string } {
  const rawUrl = process.env.OCTOPRINT_URL?.trim();
  const apiKey = process.env.OCTOPRINT_API_KEY?.trim();

  if (!rawUrl || !apiKey) {
    throw new OctoPrintError('OctoPrint is not configured', 503);
  }

  try {
    const url = new URL(rawUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid OctoPrint URL');
    }

    return {
      baseUrl: url.toString().replace(/\/+$/, ''),
      apiKey,
    };
  } catch {
    throw new OctoPrintError('OctoPrint configuration is invalid', 503);
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const { baseUrl, apiKey } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': apiKey,
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } catch {
    throw new OctoPrintError('Unable to reach OctoPrint', 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OctoPrintError('OctoPrint request failed', 502);
  }

  if (response.status === 204) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    throw new OctoPrintError('OctoPrint returned an invalid response', 502);
  }
}

export function getOctoPrintConnection(): Promise<unknown> {
  return request('connection');
}

export function getOctoPrintJob(): Promise<unknown> {
  return request('job');
}

/** Sends only the documented pause/resume/cancel job commands. */
export async function sendOctoPrintCommand(command: OctoPrintCommand): Promise<void> {
  const payload = command === 'cancel'
    ? { command: 'cancel' }
    : { command: 'pause', action: command };

  await request('job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
