import { NextResponse } from 'next/server';
import { decodeProtectedHeader } from 'jose';
import { off } from 'process';

export async function GET() {
  // API URL and Authorization
  console.log("Get departures")
  try{
    const response = await getAccessToken();
    if (!response.ok){
      throw Error(await response.json());
    }
  } catch (err){
    return NextResponse.json({ error: "No access token available: " + err }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_VASTTRAFIK_API_URL;
  const authKey = process.env.NEXT_VASTTRAFIK_AUTH_KEY;

  if (!apiUrl) {
    return NextResponse.json({ error: "No api url configured" }, { status: 400 });
  }

  if (!authKey) {
    return NextResponse.json({ error: 'No auth key configured' }, { status: 400 });
  }

  // https://ext-api.vasttrafik.se/pr/v4/locations/by-text?q=ULLEVI%20NORRA%2C%20G%C3%B6teborg&types=stoparea&limit=1&offset=0&bodSearch=false
  const ulleviNorra = "9021014007171000";

  const timeSpanInMinutes= 60;
  const maxDeparturesPerLineAndDirection = 2;
  const limit=20;
  const offset=0;
  const includeOccupancy=false;

  // Making the API request
  const response = await fetch(`${apiUrl}/stop-areas/${ulleviNorra}/departures?timeSpanInMinutes=${timeSpanInMinutes}&maxDeparturesPerLineAndDirection=${maxDeparturesPerLineAndDirection}&limit=${limit}&offset=${offset}&includeOccupancy=${includeOccupancy}`, {
    next: { revalidate: 5 },
    headers: {
      'Authorization': `Bearer ${access_token.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch data: ' + JSON.stringify(data) }, { status: response.status });
  }

  return NextResponse.json(data);
}

let access_token: AccessToken;

type AccessToken = {
  access_token: string;
  scope: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

async function getAccessToken() {

  console.log("Get latest access token")

  const tokenUrl = process.env.NEXT_VASTTRAFIK_TOKEN_URL;
  const authKey = process.env.NEXT_VASTTRAFIK_AUTH_KEY;

  if (!tokenUrl || !authKey) {
    const items = `tokenUrl: ${tokenUrl} authKey ${authKey}`
    return NextResponse.json({ error: `Missing API auth information, check variables: ${items}` }, { status: 401 });
  }

  let response;
  try {
    // Send a POST request to get the token
    response = await fetch(tokenUrl, {
      next: { revalidate: 86400 },
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials'
      })                       
    });
  } catch(err){
    return NextResponse.json({ error: `Failed to retrieve access token: ${err}` }, { status: response?.status });
  }

  try {
    const data = await response?.json();
    if (!response?.ok) {
      return NextResponse.json({ error: `Failed to retrieve access token: ${data.error}` }, { status: response?.status });
    }
    access_token = data;
    return NextResponse.json(access_token);
  } catch (err) {
    return NextResponse.json({ error: `Failed to retrieve access token` }, { status: response?.status });
  }
}
