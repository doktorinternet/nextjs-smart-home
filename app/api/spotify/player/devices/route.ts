import { runPlayerRead } from '../route-utils';
import { getSpotifyDevices } from '@/app/lib/spotify-player';

export const dynamic = 'force-dynamic';

export async function GET() {
  return runPlayerRead(getSpotifyDevices);
}
