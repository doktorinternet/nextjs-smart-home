# Electrolux Pure A9 telemetry

The dashboard reads Pure A9 appliance state through the Electrolux Developer API. The integration is read-only and calls only appliance discovery, appliance state, and token refresh endpoints. It does not send appliance commands.

## Configure local credentials

Create an ignored `.env.local` file at the project root and set:

```dotenv
ELECTROLUX_API_KEY=your-developer-api-key
ELECTROLUX_REFRESH_TOKEN=your-account-refresh-token
ELECTROLUX_TOKEN_ENCRYPTION_KEY=your-32-byte-base64url-key
ELECTROLUX_TOKEN_STORE_PATH=C:\Users\your-name\AppData\Local\smart-home-kiosk\electrolux-token.enc
# Optional when the API account has multiple appliances:
ELECTROLUX_APPLIANCE_ID=your-appliance-id
```

Generate an encryption key locally with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Keep these values in the ignored `.env.local`; do not put them in tracked `.env` files or share them in chat. The server exchanges the refresh token for an access token when needed; the access token stays in server memory and is reused until near expiry. The first successful request encrypts the refresh token to the absolute token-store path. Later refresh-token rotations are persisted there atomically. Once the encrypted store exists, `ELECTROLUX_REFRESH_TOKEN` can be removed from `.env.local`.

Restart the development server after editing `.env.local`. On the dashboard, the Pure A9 panel refreshes every minute and shows supported readings returned by the account. The server response contains selected readings only; credentials and access tokens remain server-side.

## Telemetry history

Every successful `GET /api/electrolux/status` stores numeric readings returned by the appliance in the shared telemetry SQLite database. Failed API calls and missing or non-numeric readings are not stored. The live status response remains display-oriented; history uses stable IDs such as `air.pm25`, numeric values, units, the appliance ID as `sourceId`, and the server observation time in UTC. It does not store localized labels, provider payloads, or credentials.

`GET /api/telemetry/history` returns newest-first measurement records by default, preserving the original response behavior. Optional query parameters are `sourceId`, `metricId`, `from`, `to` (ISO date/time), `kind=measurement|event|all`, and `eventType`; `limit` defaults to 100 and is capped at 1,000. Example: `/api/telemetry/history?sourceId=<appliance-id>&metricId=air.pm25&limit=300`. Use `kind=all` to combine numeric readings and events.

The printer status route also records actual tool and bed temperatures plus deduplicated connection/job state changes. A transition into an active print records `started`; leaving active or paused printing records `stopped`. The dashboard polls Electrolux every 60 seconds and OctoPrint every 15 seconds while their automatic refresh controls are enabled. The combined chart shows PM2.5 with tool and bed temperatures on separate normalized scales, plus print start/stop markers. History begins only after these successful status polls run; no earlier history is available.

The database path is `TELEMETRY_DATABASE_PATH`, which must be absolute. If unset, it is `data/telemetry.sqlite` under the application working directory. For a service deployment, set it to a stable data directory outside release folders (for example `C:\\ProgramData\\SmartHomeKiosk\\data\\telemetry.sqlite`) and grant the app service identity read/write/modify access to that directory. SQLite uses write-ahead logging, so keep the database, `-wal`, and `-shm` files together; do not put it on a network share. Back up with SQLite's online backup API or stop the app and copy the database and sidecar files together. Retention is currently unlimited; plan periodic backups and monitor disk use until a retention policy is selected.

Storage uses Node's built-in `node:sqlite` and SQLite, with no native npm add-on. It requires Node.js 22.13 or newer to run without a flag; Node.js 22.5 through 22.12 requires `--experimental-sqlite`. Node.js 24.15+ marks the API release candidate, though the API is still evolving. The local build was checked with Node.js 24.21.0. Server01's installed Node.js version is not yet confirmed; upgrade it to a supported current Node.js release before enabling telemetry if it is older than 22.13. A local TypeScript declaration bridges this runtime module because the project's installed `@types/node` v20 does not declare `node:sqlite`.
