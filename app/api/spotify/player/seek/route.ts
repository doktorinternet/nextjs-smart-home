import { NextRequest } from 'next/server';
import { seekSpotifyPlayback } from '@/app/lib/spotify-player';
import { hasOnlyKeys, invalidPlayerRequest, optionalDeviceId, readJsonObject, runPlayerControl } from '../route-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return runPlayerControl(request, async () => {
    const body = await readJsonObject(request);
    if (!body || !hasOnlyKeys(body, ['deviceId', 'positionMs']) || !Number.isSafeInteger(body.positionMs) ||
      (body.positionMs as number) < 0 || (body.positionMs as number) > 86_400_000) {
      throw invalidPlayerRequest();
    }
    const deviceId = optionalDeviceId(body);
    if (deviceId === null) throw invalidPlayerRequest();
    await seekSpotifyPlayback(body.positionMs as number, deviceId);
  });
}
