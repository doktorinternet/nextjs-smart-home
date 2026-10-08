import 'server-only';

import { SpotifyAuthConfigError, refreshSpotifyAccessToken } from '@/app/lib/spotify-auth';

const spotifyApiBase = 'https://api.spotify.com/v1';
type PlayerEndpoint = '/me/player' | '/me/player/devices' | '/me/player/pause' | '/me/player/play' | '/me/player/next' | '/me/player/previous' | '/me/player/volume';
type PlayerMethod = 'GET' | 'PUT' | 'POST';

export class SpotifyPlayerError extends Error {
  readonly status: number;

  constructor(status = 502) {
    const safeErrors: Record<number, string> = {
      401: 'Spotify authorization is required or was rejected',
      403: 'Spotify player action is not available',
      404: 'Spotify player resource was not found',
      429: 'Spotify rate limit reached',
    };
    super(safeErrors[status] ?? 'Spotify player service is unavailable');
    this.name = 'SpotifyPlayerError';
    this.status = safeErrors[status] ? status : 502;
  }
}

function withQuery(endpoint: PlayerEndpoint, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${endpoint}?${suffix}` : endpoint;
}

async function spotifyRequest(endpoint: PlayerEndpoint, method: PlayerMethod, options: {
  query?: Record<string, string | undefined>;
  body?: unknown;
} = {}): Promise<unknown | null> {
  try {
    const { accessToken } = await refreshSpotifyAccessToken();
    const response = await fetch(new URL(withQuery(endpoint, options.query ?? {}), spotifyApiBase), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) throw new SpotifyPlayerError(response.status);
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    if (error instanceof SpotifyPlayerError || error instanceof SpotifyAuthConfigError) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      throw new SpotifyPlayerError(401);
    }
    throw new SpotifyPlayerError();
  }
}

export async function getSpotifyPlayback(): Promise<unknown | null> {
  return spotifyRequest('/me/player', 'GET');
}

export async function getSpotifyDevices(): Promise<unknown | null> {
  return spotifyRequest('/me/player/devices', 'GET');
}

export async function pauseSpotifyPlayback(deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/pause', 'PUT', { query: { device_id: deviceId } });
}

export async function resumeSpotifyPlayback(deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/play', 'PUT', { query: { device_id: deviceId } });
}

export async function skipSpotifyNext(deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/next', 'POST', { query: { device_id: deviceId } });
}

export async function skipSpotifyPrevious(deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/previous', 'POST', { query: { device_id: deviceId } });
}

export async function transferSpotifyPlayback(deviceId: string, play?: boolean): Promise<void> {
  await spotifyRequest('/me/player', 'PUT', {
    body: { device_ids: [deviceId], ...(play === undefined ? {} : { play }) },
  });
}

export async function setSpotifyVolume(volumePercent: number, deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/volume', 'PUT', {
    query: { volume_percent: String(volumePercent), device_id: deviceId },
  });
}
