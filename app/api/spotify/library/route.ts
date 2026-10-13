import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyCuratedPlaylists, getSpotifySavedSpokenContent } from '@/app/lib/spotify-player';
import { runPlayerRead } from '../player/route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind');
  if (kind === 'playlists') return runPlayerRead(getSpotifyCuratedPlaylists);
  if (kind === 'spoken') return runPlayerRead(getSpotifySavedSpokenContent);
  return NextResponse.json({ error: 'Invalid content type' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}
