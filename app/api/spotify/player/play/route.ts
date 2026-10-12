import { NextRequest } from 'next/server';
import { startSpotifyPlayback } from '@/app/lib/spotify-player';
import { hasOnlyKeys, invalidPlayerRequest, optionalDeviceId, readJsonObject, runPlayerControl } from '../route-utils';

export const dynamic = 'force-dynamic';

const playlistUri = /^spotify:playlist:[A-Za-z0-9]+$/;
const episodeUri = /^spotify:episode:[A-Za-z0-9]+$/;

export async function POST(request: NextRequest) {
  return runPlayerControl(request, async () => {
    const body = await readJsonObject(request);
    if (!body || !hasOnlyKeys(body, ['deviceId', 'contextUri', 'uri'])) throw invalidPlayerRequest();
    const deviceId = optionalDeviceId(body);
    if (deviceId === null) throw invalidPlayerRequest();
    const contextUri = body.contextUri;
    const uri = body.uri;
    if ((typeof contextUri === 'string' && playlistUri.test(contextUri) && uri === undefined) ||
      (typeof uri === 'string' && episodeUri.test(uri) && contextUri === undefined)) {
      await startSpotifyPlayback({ deviceId, contextUri: contextUri as string | undefined, uri: uri as string | undefined });
      return;
    }
    throw invalidPlayerRequest();
  });
}
