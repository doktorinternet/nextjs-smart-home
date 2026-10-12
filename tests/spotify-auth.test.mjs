import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NextRequest } from 'next/server';

const directory = mkdtempSync(join(tmpdir(), 'spotify-auth-'));
process.env.SPOTIFY_CLIENT_ID = 'mock-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'mock-client-secret';
process.env.SPOTIFY_REDIRECT_URI = 'https://kiosk.example/api/spotify/auth/callback';
process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64url');
process.env.SPOTIFY_TOKEN_STORE_PATH = join(directory, 'token.enc');

const expectedScopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-playback-position',
];
let grantedScopes = expectedScopes;
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), 'https://accounts.spotify.com/api/token');
  assert.equal(init?.method, 'POST');
  return Response.json({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    scope: grantedScopes.join(' '),
  });
};

try {
  const { GET: startAuthorization } = await import('../app/api/spotify/auth/start/route.ts');
  const { GET: completeAuthorization } = await import('../app/api/spotify/auth/callback/route.ts');
  const { GET: getPermissionStatus } = await import('../app/api/spotify/auth/status/route.ts');

  const unverifiedResponse = await getPermissionStatus();
  assert.deepEqual(await unverifiedResponse.json(), {
    status: 'unverified',
    connected: false,
    expectedScopes,
    grantedScopes: [],
    missingScopes: expectedScopes,
  });

  const startResponse = await startAuthorization();
  assert.equal(startResponse.status, 303);
  const authorizationUrl = new URL(startResponse.headers.get('location'));
  assert.equal(authorizationUrl.searchParams.get('show_dialog'), 'true');
  assert.deepEqual(authorizationUrl.searchParams.get('scope')?.split(' '), expectedScopes);

  const state = authorizationUrl.searchParams.get('state');
  const stateCookie = startResponse.cookies.get('spotify_auth_state')?.value;
  assert.ok(state);
  assert.ok(stateCookie);
  const callbackRequest = new NextRequest(
    `https://kiosk.example/api/spotify/auth/callback?code=mock-code&state=${state}`,
    { headers: { cookie: `spotify_auth_state=${stateCookie}` } },
  );
  const callbackResponse = await completeAuthorization(callbackRequest);
  assert.equal(callbackResponse.status, 303);
  assert.equal(callbackResponse.headers.get('location'), 'https://kiosk.example/settings?spotify=connected');

  const completeResponse = await getPermissionStatus();
  assert.deepEqual(await completeResponse.json(), {
    status: 'complete',
    connected: true,
    expectedScopes,
    grantedScopes: expectedScopes,
    missingScopes: [],
  });

  grantedScopes = expectedScopes.filter((scope) => scope !== 'playlist-read-collaborative');
  const partialStartResponse = await startAuthorization();
  const partialAuthorizationUrl = new URL(partialStartResponse.headers.get('location'));
  const partialStateCookie = partialStartResponse.cookies.get('spotify_auth_state')?.value;
  const partialCallbackRequest = new NextRequest(
    `https://kiosk.example/api/spotify/auth/callback?code=partial-code&state=${partialAuthorizationUrl.searchParams.get('state')}`,
    { headers: { cookie: `spotify_auth_state=${partialStateCookie}` } },
  );
  await completeAuthorization(partialCallbackRequest);

  const partialResponse = await getPermissionStatus();
  const partialStatus = await partialResponse.json();
  assert.equal(partialStatus.status, 'missing');
  assert.deepEqual(partialStatus.missingScopes, ['playlist-read-collaborative']);
  assert.equal(JSON.stringify(partialStatus).includes('mock-refresh-token'), false);
  assert.equal(JSON.stringify(partialStatus).includes('mock-access-token'), false);

  console.log('Spotify authorization and permission-status lifecycle checks passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}