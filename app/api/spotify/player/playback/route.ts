import { runPlayerRead } from '../route-utils';
import { getSpotifyPlayback } from '@/app/lib/spotify-player';

export const dynamic = 'force-dynamic';

export async function GET() {
  return runPlayerRead(getSpotifyPlayback);
}
