import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const directory = mkdtempSync(join(tmpdir(), 'electrolux-auth-'));
process.env.ELECTROLUX_API_KEY = 'mock-api-key';
process.env.ELECTROLUX_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64url');
process.env.ELECTROLUX_TOKEN_STORE_PATH = join(directory, 'token.enc');
process.env.ELECTROLUX_REFRESH_TOKEN = 'configured-current-token';
const statePayload = { properties: { reported: { pm25: 3, Temp: 22, Humidity: 38, Workmode: 'Auto', FilterLife: 37 } } };
const calls = [];
globalThis.fetch = async (url, init) => {
  const body = init?.body ? JSON.parse(init.body) : {};
  calls.push({ url: String(url), refreshToken: body.refreshToken });
  if (String(url).endsWith('/api/v1/token/refresh')) {
    if (body.refreshToken === 'configured-current-token') {
      return Response.json({ accessToken: 'mock-access-token', refreshToken: 'rotated-token', expiresIn: 0.01 });
    }
    return Response.json({ error: 'invalid_grant' }, { status: 401 });
  }
  if (String(url).endsWith('/api/v1/appliances')) return Response.json([{ id: 'mock-appliance', name: 'Mock' }]);
  if (String(url).endsWith('/state')) return Response.json(statePayload);
  throw new Error('Unexpected mocked URL');
};

try {
  const { getElectroluxStatus } = await import('../app/lib/electrolux.ts');
  // First successful use initializes the encrypted persisted token.
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (String(url).endsWith('/api/v1/token/refresh')) {
      calls.push({ url: String(url), refreshToken: body.refreshToken });
      return Response.json({ accessToken: 'first-access', refreshToken: 'stale-persisted-token', expiresIn: 0.01 });
    }
    if (String(url).endsWith('/api/v1/appliances')) return Response.json([{ id: 'mock-appliance', name: 'Mock' }]);
    if (String(url).endsWith('/state')) return Response.json(statePayload);
    throw new Error('Unexpected mocked URL');
  };
  await getElectroluxStatus();
  calls.length = 0;
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (String(url).endsWith('/api/v1/token/refresh')) {
      calls.push({ url: String(url), refreshToken: body.refreshToken });
      if (body.refreshToken === 'stale-persisted-token') return Response.json({ error: 'invalid_grant' }, { status: 401 });
      return Response.json({ accessToken: 'recovered-access', refreshToken: 'rotated-token', expiresIn: 0.01 });
    }
    if (String(url).endsWith('/api/v1/appliances')) return Response.json([{ id: 'mock-appliance', name: 'Mock' }]);
    if (String(url).endsWith('/state')) return Response.json(statePayload);
    throw new Error('Unexpected mocked URL');
  };
  const recoveredStatus = await getElectroluxStatus();
  assert.deepEqual(calls.map(({ refreshToken }) => refreshToken), ['stale-persisted-token', 'configured-current-token']);
  assert.deepEqual(recoveredStatus.metrics.filter(({ label }) => ['L' + String.fromCharCode(228) + 'ge', 'Temperatur'].includes(label)).map(({ label, value }) => [label, value]), [['Temperatur', '22 °C'], ['L' + String.fromCharCode(228) + 'ge', 'Auto']]);
  assert.deepEqual(recoveredStatus.readings.filter(({ kind }) => kind === 'event').map(({ eventType, eventValue }) => [eventType, eventValue]), [['air.mode-state', 'Auto']]);
  assert.deepEqual(recoveredStatus.readings.filter(({ kind }) => kind === 'measurement').map(({ metricId }) => metricId), ['air.pm25', 'air.temperature', 'air.humidity', 'air.filter_life']);
  calls.length = 0;
  await getElectroluxStatus();
  assert.deepEqual(calls.filter(({ url }) => url.endsWith('/api/v1/token/refresh')).map(({ refreshToken }) => refreshToken), ['rotated-token']);
  console.log('Electrolux stale refresh-token recovery checks passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
