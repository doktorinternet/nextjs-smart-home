import { NextRequest } from 'next/server';
import { setSpotifyVolume } from '@/app/lib/spotify-player';
import { hasOnlyKeys, invalidPlayerRequest, optionalDeviceId, readJsonObject, runPlayerControl } from '../route-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return runPlayerControl(request, async () => {
    const body = await readJsonObject(request);
    if (!body || !hasOnlyKeys(body, ['deviceId', 'volumePercent'])) throw invalidPlayerRequest();
    const deviceId = optionalDeviceId(body);
    if (deviceId === null || !Number.isInteger(body.volumePercent) ||
      (body.volumePercent as number) < 0 || (body.volumePercent as number) > 100) {
      throw invalidPlayerRequest();
    }
    await setSpotifyVolume(body.volumePercent as number, deviceId);
  });
}
