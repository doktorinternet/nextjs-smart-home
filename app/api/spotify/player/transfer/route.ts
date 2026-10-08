import { NextRequest } from 'next/server';
import { transferSpotifyPlayback } from '@/app/lib/spotify-player';
import { hasOnlyKeys, invalidPlayerRequest, readJsonObject, runPlayerControl, validDeviceId } from '../route-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return runPlayerControl(request, async () => {
    const body = await readJsonObject(request);
    if (!body || !hasOnlyKeys(body, ['deviceId', 'play']) || !validDeviceId(body.deviceId)) {
      throw invalidPlayerRequest();
    }
    if (body.play !== undefined && typeof body.play !== 'boolean') throw invalidPlayerRequest();
    await transferSpotifyPlayback(body.deviceId, body.play as boolean | undefined);
  });
}
