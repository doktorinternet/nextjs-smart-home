import { NextResponse } from 'next/server';
import {
  createSpotifyAuthorizationRequest,
  getSpotifyStateCookieOptions,
  SpotifyAuthConfigError,
} from '@/app/lib/spotify-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { url, signedState } = createSpotifyAuthorizationRequest();
    const response = NextResponse.redirect(url, 303);
    response.cookies.set({ ...getSpotifyStateCookieOptions(), value: signedState });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    const status = error instanceof SpotifyAuthConfigError ? 503 : 500;
    return NextResponse.json(
      { error: status === 503 ? 'Spotify-auktorisering är inte konfigurerad.' : 'Det gick inte att starta Spotify-auktoriseringen.' },
      { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    );
  }
}
