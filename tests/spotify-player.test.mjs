import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NextRequest } from 'next/server';

const directory = mkdtempSync(join(tmpdir(), 'spotify-player-'));
const expectedScopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-playback-position',
];
process.env.SPOTIFY_CLIENT_ID = 'mock-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'mock-client-secret';
process.env.SPOTIFY_REDIRECT_URI = 'https://kiosk.example/api/spotify/auth/callback';
process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64url');
process.env.SPOTIFY_TOKEN_STORE_PATH = join(directory, 'token.enc');

let spotifyRequest = async () => new Response(null, { status: 204 });
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://accounts.spotify.com/api/token') {
    return Response.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      scope: expectedScopes.join(' '),
      expires_in: 3600,
    });
  }
  return spotifyRequest(url, init);
};

try {
  const { GET: startAuthorization } = await import('../app/api/spotify/auth/start/route.ts');
  const { GET: completeAuthorization } = await import('../app/api/spotify/auth/callback/route.ts');
  const startResponse = await startAuthorization();
  const authorizationUrl = new URL(startResponse.headers.get('location'));
  const stateCookie = startResponse.cookies.get('spotify_auth_state')?.value;
  const callbackRequest = new NextRequest(
    `https://kiosk.example/api/spotify/auth/callback?code=mock-code&state=${authorizationUrl.searchParams.get('state')}`,
    { headers: { cookie: `spotify_auth_state=${stateCookie}` } },
  );
  await completeAuthorization(callbackRequest);

  const { SpotifyPlayerError, getSpotifyPlayback, pauseSpotifyPlayback } = await import('../app/lib/spotify-player.ts');
  const failures = [];
  const originalConsoleError = console.error;
  console.error = (...values) => failures.push(values);

  spotifyRequest = async () => { throw new DOMException('request timed out', 'TimeoutError'); };
  await assert.rejects(pauseSpotifyPlayback(), (error) =>
    error instanceof SpotifyPlayerError && error.status === 504 && error.message.includes('timed out'));

  spotifyRequest = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
  };
  await assert.rejects(pauseSpotifyPlayback(), (error) =>
    error instanceof SpotifyPlayerError && error.status === 502 && error.message.includes('network'));

  spotifyRequest = async () => new Response('', { status: 200 });
  await assert.doesNotReject(pauseSpotifyPlayback());

  spotifyRequest = async () => new Response('OK', { status: 200 });
  await assert.doesNotReject(pauseSpotifyPlayback());

  spotifyRequest = async () => new Response('not-json', { status: 200 });
  await assert.rejects(getSpotifyPlayback(), (error) =>
    error instanceof SpotifyPlayerError && error.status === 502 && error.message.includes('invalid success response'));

  console.error = originalConsoleError;
  assert.deepEqual(failures.map((entry) => entry[1].kind ?? 'invalid_response_body'), [
    'timeout',
    'network',
    'invalid_response_body',
  ]);
  console.log('Spotify player timeout, network, and response diagnostics passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}