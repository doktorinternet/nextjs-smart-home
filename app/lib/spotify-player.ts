import 'server-only';

import {
  SpotifyAuthConfigError,
  SpotifyTokenRequestError,
  refreshSpotifyAccessToken,
} from '@/app/lib/spotify-auth';
import { spotifyPlaylistSelection } from '@/app/lib/spotify-playlist-selection';

const spotifyApiBase = 'https://api.spotify.com/v1';
type PlayerEndpoint = '/me' | '/me/player' | '/me/player/devices' | '/me/player/pause' | '/me/player/play' | '/me/player/next' | '/me/player/previous' | '/me/player/volume' | '/me/player/shuffle' | '/me/player/repeat' | '/me/player/seek' | '/me/playlists' | '/me/episodes' | '/me/audiobooks';
type PlayerMethod = 'GET' | 'PUT' | 'POST';

export class SpotifyPlayerError extends Error {
  readonly status: number;

  constructor(
    status = 502,
    stage: 'token_refresh' | 'player_api' | 'player_network' | 'player_timeout' | 'player_response' = 'player_api',
    providerMessage?: string,
  ) {
    const safeErrors: Record<number, string> = {
      401: 'Spotify authorization is required or was rejected',
      403: 'Spotify player action is not available',
      404: 'Spotify player resource was not found',
      429: 'Spotify rate limit reached',
    };
    const fallback = stage === 'token_refresh'
      ? 'Spotify access token refresh failed'
      : stage === 'player_timeout'
        ? 'Spotify player API request timed out'
        : stage === 'player_response'
          ? 'Spotify player API returned an invalid success response'
      : stage === 'player_network'
        ? 'Spotify player API request failed due to a network or timeout error'
        : status >= 400 && status <= 599
          ? `Spotify player API returned HTTP ${status}`
          : 'Spotify player service is unavailable';
    const safeProviderMessage = providerMessage?.replace(/[\r\n\t]+/g, ' ').slice(0, 200);
    super(safeErrors[status] ?? (safeProviderMessage
      ? `Spotify player API returned HTTP ${status}: ${safeProviderMessage}`
      : fallback));
    this.name = 'SpotifyPlayerError';
    this.status = stage === 'player_timeout' ? 504 : safeErrors[status] ? status : 502;
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

async function getSpotifyAccessToken(): Promise<string> {
  try {
    return (await refreshSpotifyAccessToken()).accessToken;
  } catch (error) {
    console.error(error);
    if (error instanceof SpotifyAuthConfigError) throw error;
    if (error instanceof SpotifyTokenRequestError) {
      if (error.status === 400 || error.status === 401) throw new SpotifyPlayerError(401);
      if (error.status === 403) throw new SpotifyPlayerError(403);
      if (error.status === 429) throw new SpotifyPlayerError(429);
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      throw new SpotifyPlayerError(401);
    }
    throw new SpotifyPlayerError(502, 'token_refresh');
  }
}

async function spotifyRequest(endpoint: PlayerEndpoint, method: PlayerMethod, options: {
  query?: Record<string, string | undefined>;
  body?: unknown;
  accessToken?: string;
} = {}): Promise<unknown | null> {
  const accessToken = options.accessToken ?? await getSpotifyAccessToken();

  const requestStartedAt = Date.now();
  const timeoutSignal = AbortSignal.timeout(10_000);
  try {
    const response = await fetch(`${spotifyApiBase}${withQuery(endpoint, options.query ?? {})}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      cache: 'no-store',
      signal: timeoutSignal,
    });

    if (!response.ok) {
      let providerMessage: string | undefined;
      try {
        const result: unknown = await response.json();
        if (typeof result === 'object' && result !== null && 'error' in result) {
          const error = result.error;
          if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
            providerMessage = error.message;
          }
        }
      } catch {
        // Some unsuccessful Spotify responses have no JSON body.
      }
      throw new SpotifyPlayerError(response.status, 'player_api', providerMessage);
    }
    if (response.status === 204 || method !== 'GET') return null;
    const responseBody = await response.text();
    if (responseBody.trim().length === 0) return null;
    try {
      return JSON.parse(responseBody) as unknown;
    } catch (error) {
      console.error('[spotify-player] invalid success response body', {
        method,
        endpoint,
        status: response.status,
        elapsedMs: Date.now() - requestStartedAt,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new SpotifyPlayerError(502, 'player_response');
    }
  } catch (error) {
    if (error instanceof SpotifyPlayerError) throw error;
    const timedOut = timeoutSignal.aborted || (error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError'));
    const cause = error instanceof Error ? error.cause : undefined;
    const errorCode = typeof cause === 'object' && cause !== null && 'code' in cause &&
      typeof cause.code === 'string' ? cause.code : undefined;
    console.error('[spotify-player] outbound request failed', {
      method,
      endpoint,
      elapsedMs: Date.now() - requestStartedAt,
      kind: timedOut ? 'timeout' : 'network',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      ...(errorCode ? { errorCode } : {}),
    });
    throw new SpotifyPlayerError(502, timedOut ? 'player_timeout' : 'player_network');
  }
}

export async function getSpotifyPlayback(): Promise<unknown | null> {
  return spotifyRequest('/me/player', 'GET');
}

export async function getSpotifyCurrentUser(): Promise<unknown | null> {
  return spotifyRequest('/me', 'GET');
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

export async function setSpotifyShuffle(state: boolean, deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/shuffle', 'PUT', {
    query: { state: String(state), device_id: deviceId },
  });
}

export async function setSpotifyRepeat(state: 'off' | 'context' | 'track', deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/repeat', 'PUT', {
    query: { state, device_id: deviceId },
  });
}

export async function seekSpotifyPlayback(positionMs: number, deviceId?: string): Promise<void> {
  await spotifyRequest('/me/player/seek', 'PUT', {
    query: { position_ms: String(positionMs), device_id: deviceId },
  });
}

export async function startSpotifyPlayback(options: {
  deviceId?: string;
  contextUri?: string;
  uri?: string;
}): Promise<void> {
  await spotifyRequest('/me/player/play', 'PUT', {
    query: { device_id: options.deviceId },
    body: options.contextUri
      ? { context_uri: options.contextUri }
      : { uris: options.uri ? [options.uri] : [] },
  });
}

function requestSavedPlaylists(limit: number, offset: number, accessToken?: string): Promise<unknown | null> {
  return spotifyRequest('/me/playlists', 'GET', {
    query: { limit: String(limit), offset: String(offset) },
    accessToken,
  });
}

export async function getSpotifySavedPlaylists(limit = 30, offset = 0): Promise<unknown | null> {
  return requestSavedPlaylists(limit, offset);
}

export async function getSpotifyCuratedPlaylists(random: () => number = Math.random) {
  const selectedIds = new Set<string>(spotifyPlaylistSelection);
  const selected = new Map<string, Record<string, unknown>>();
  const accessToken = await getSpotifyAccessToken();
  let total: number | null = null;
  let offset = 0;
  let fetched = 0;

  while (total === null || fetched < total) {
    const page = await requestSavedPlaylists(50, offset, accessToken);
    if (typeof page !== 'object' || page === null ||
      !('items' in page) || !Array.isArray(page.items) ||
      !('total' in page) || typeof page.total !== 'number') {
      throw new SpotifyPlayerError(502, 'player_response');
    }

    total = page.total;
    if (page.items.length === 0) break;

    for (const playlist of page.items) {
      fetched++;
      if (typeof playlist !== 'object' || playlist === null ||
        !('id' in playlist) || typeof playlist.id !== 'string' ||
        !selectedIds.has(playlist.id) || selected.has(playlist.id)) continue;
      selected.set(playlist.id, playlist as Record<string, unknown>);
    }
    offset += page.items.length;
  }

  const items = [...selected.values()];
  for (let index = items.length - 1; index > 0; index--) {
    const targetIndex = Math.floor(random() * (index + 1));
    const item = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = item;
  }
  return { items, total: items.length };
}

async function getSavedItems(endpoint: '/me/episodes' | '/me/audiobooks') {
  try {
    const response = await spotifyRequest(endpoint, 'GET', { query: { limit: '20' } });
    if (typeof response !== 'object' || response === null || !('items' in response) || !Array.isArray(response.items)) {
      return { available: true, items: [] };
    }
    return { available: true, items: response.items };
  } catch (error) {
    if (error instanceof SpotifyPlayerError && (error.status === 403 || error.status === 404)) {
      return { available: false, items: [] };
    }
    throw error;
  }
}

export async function getSpotifySavedSpokenContent() {
  const [episodes, audiobooks] = await Promise.all([
    getSavedItems('/me/episodes'),
    getSavedItems('/me/audiobooks'),
  ]);
  return { episodes, audiobooks };
}
