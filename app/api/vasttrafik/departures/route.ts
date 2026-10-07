import { NextResponse } from 'next/server';

type AccessToken = {
  access_token: string;
  expires_at: number;
};

let cachedToken: AccessToken | undefined;

const safeError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function GET() {
  const apiUrl = process.env.NEXT_VASTTRAFIK_API_URL;
  const tokenUrl = process.env.NEXT_VASTTRAFIK_TOKEN_URL;
  const authKey = process.env.NEXT_VASTTRAFIK_AUTH_KEY;

  if (!apiUrl || !tokenUrl || !authKey) {
    return safeError('Västtrafik API is not configured', 503);
  }

  let token = await getAccessToken(tokenUrl, authKey);
  if (!token) {
    return safeError('Unable to authenticate with Västtrafik', 502);
  }

  const stopAreaId = '9021014007171000';
  const query = new URLSearchParams({
    timeSpanInMinutes: '60',
    maxDeparturesPerLineAndDirection: '2',
    limit: '20',
    offset: '0',
    includeOccupancy: 'false',
  });
  const departuresUrl = `${apiUrl.replace(/\/$/, '')}/stop-areas/${stopAreaId}/departures?${query}`;

  let response: Response;
  try {
    response = await fetchDepartures(departuresUrl, token);

    // A token can be revoked before its advertised expiry. Refresh once on 401.
    if (response.status === 401) {
      cachedToken = undefined;
      token = await getAccessToken(tokenUrl, authKey, true);
      if (!token) {
        return safeError('Unable to authenticate with Västtrafik', 502);
      }
      response = await fetchDepartures(departuresUrl, token);
    }
  } catch {
    return safeError('Unable to fetch Västtrafik departures', 502);
  }

  if (!response.ok) {
    return safeError('Västtrafik departures request failed', 502);
  }

  try {
    const data: unknown = await response.json();
    return NextResponse.json(data);
  } catch {
    return safeError('Västtrafik returned an invalid departures response', 502);
  }
}

async function fetchDepartures(url: string, token: string): Promise<Response> {
  return fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}

async function getAccessToken(
  tokenUrl: string,
  authKey: string,
  forceRefresh = false,
): Promise<string | undefined> {
  // Refresh a little early so a token does not expire during a departures call.
  if (!forceRefresh && cachedToken && cachedToken.expires_at > Date.now() + 30_000) {
    return cachedToken.access_token;
  }

  try {
    const response = await fetch(tokenUrl, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        Authorization: `Basic ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!response.ok) {
      cachedToken = undefined;
      return undefined;
    }

    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('access_token' in data) ||
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      !('expires_in' in data) ||
      typeof data.expires_in !== 'number' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    ) {
      cachedToken = undefined;
      return undefined;
    }

    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.access_token;
  } catch {
    cachedToken = undefined;
    return undefined;
  }
}
