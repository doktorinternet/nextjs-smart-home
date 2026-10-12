import { NextRequest } from 'next/server';
import { setSpotifyShuffle } from '@/app/lib/spotify-player';
import { hasOnlyKeys, invalidPlayerRequest, optionalDeviceId, readJsonObject, runPlayerControl } from '../route-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return runPlayerControl(request, async () => {
    const body = await readJsonObject(request);
    if (!body || !hasOnlyKeys(body, ['deviceId', 'state']) || typeof body.state !== 'boolean') {
      throw invalidPlayerRequest();
    }
    const deviceId = optionalDeviceId(body);
    if (deviceId === null) throw invalidPlayerRequest();
    await setSpotifyShuffle(body.state, deviceId);
  });
}
