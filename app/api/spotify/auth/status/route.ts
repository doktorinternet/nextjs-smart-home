import { NextResponse } from 'next/server';
import { copy } from '@/app/copy';
import { getSpotifyPermissionStatus, SpotifyAuthConfigError } from '@/app/lib/spotify-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getSpotifyPermissionStatus(), {
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch (error) {
    const status = error instanceof SpotifyAuthConfigError ? 503 : 500;
    return NextResponse.json(
      { error: copy.settings.permissionCheckFailed },
      { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    );
  }
}