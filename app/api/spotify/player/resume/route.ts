import { NextRequest } from 'next/server';
import { resumeSpotifyPlayback } from '@/app/lib/spotify-player';
import { hasOnlyKeys, invalidPlayerRequest, optionalDeviceId, readJsonObject, runPlayerControl } from '../route-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return runPlayerControl(request, async () => {
    const body = await readJsonObject(request);
    if (!body || !hasOnlyKeys(body, ['deviceId'])) throw invalidPlayerRequest();
    const deviceId = optionalDeviceId(body);
    if (deviceId === null) throw invalidPlayerRequest();
    await resumeSpotifyPlayback(deviceId);
  });
}
