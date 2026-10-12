# Printer API

Configure these server environment variables:

- `OCTOPRINT_URL`: OctoPrint base URL, such as `http://octoprint.local` (no credentials, query, or fragment).
- `OCTOPRINT_API_KEY`: an OctoPrint API key. It is sent only from the server in the `X-Api-Key` header.

Routes:

- `GET /api/printer/status` returns the connection state and current job state, details, and progress.
- `POST /api/printer/command` accepts exactly one JSON field, `command`, with `pause`, `resume`, or `cancel`.
Pause and resume are sent to OctoPrint as `command: "pause"` with the explicit `action: "pause"` or `action: "resume"`. Cancel is sent as `command: "cancel"`. The explicit action avoids OctoPrint's backwards-compatible default toggle behavior. No start, restart, connection, or arbitrary printer commands are exposed.

Device-control endpoints do not require a PIN or session. Keep this app reachable only from a trusted network, or protect it at your reverse proxy before exposing it beyond your home network.

## Status history

Each successful `GET /api/printer/status` poll also reads `GET /api/printer` and stores finite actual tool 0 and bed temperatures in the shared telemetry database, along with deduplicated connection and job state changes. A transition into active printing stores a `started` event; a transition out of active or paused printing stores `stopped`. Repeated status polls with unchanged states do not create duplicate transitions. The dashboard polls every 15 seconds while printer automatic refresh is enabled. History starts when polling runs and does not include earlier printer activity. Query it with `/api/telemetry/history?sourceId=octoprint&kind=all&limit=1000`.

Only selected numeric readings and state names are stored. The database does not retain OctoPrint response payloads, job details, or API keys.
