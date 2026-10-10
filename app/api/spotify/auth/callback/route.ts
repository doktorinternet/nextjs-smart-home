import { NextRequest, NextResponse } from 'next/server';
import { copy } from '@/app/copy';
import {
  assertSpotifyAuthConfigured,
  exchangeSpotifyAuthorizationCode,
  getSpotifyPostAuthUrl,
  getSpotifyStateCookieOptions,
  SpotifyAuthConfigError,
  verifySpotifyState,
} from '@/app/lib/spotify-auth';

export const dynamic = 'force-dynamic';

function callbackError(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}

export async function GET(request: NextRequest) {
  try {
    assertSpotifyAuthConfigured();
  } catch {
    return callbackError(503, copy.spotify.authorizationNotConfigured);
  }

  const stateCookie = request.cookies.get(getSpotifyStateCookieOptions().name)?.value;
  const query = request.nextUrl.searchParams;
  if (!verifySpotifyState(stateCookie, query.get('state'))) {
    return callbackError(400, copy.spotify.authorizationInvalid);
  }

  if (query.has('error')) {
    return callbackError(400, copy.spotify.authorizationCanceled);
  }

  const code = query.get('code');
  if (!code || code.length > 4096) return callbackError(400, copy.spotify.authorizationResponseInvalid);

  try {
    await exchangeSpotifyAuthorizationCode(code);
    const target = getSpotifyPostAuthUrl();
    const response = NextResponse.redirect(target, 303);
    response.cookies.set({ ...getSpotifyStateCookieOptions(), value: '', maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    const status = error instanceof SpotifyAuthConfigError ? 503 : 502;
    const response = callbackError(status, status === 503
      ? copy.spotify.authorizationNotConfigured
      : copy.spotify.authorizationCompleteFailed);
    response.cookies.set({ ...getSpotifyStateCookieOptions(), value: '', maxAge: 0 });
    return response;
  }
}
