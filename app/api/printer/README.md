# Printer API

Configure these server environment variables:

- `OCTOPRINT_URL`: OctoPrint base URL, such as `http://octoprint.local` (no credentials, query, or fragment).
- `OCTOPRINT_API_KEY`: an OctoPrint API key. It is sent only from the server in the `X-Api-Key` header.

Routes:

- `GET /api/printer/status` returns the connection state and current job state, details, and progress.
- `POST /api/printer/command` accepts exactly one JSON field, `command`, with `pause`, `resume`, or `cancel`.
Pause and resume are sent to OctoPrint as `command: "pause"` with the explicit `action: "pause"` or `action: "resume"`. Cancel is sent as `command: "cancel"`. The explicit action avoids OctoPrint's backwards-compatible default toggle behavior. No start, restart, connection, or arbitrary printer commands are exposed.

Device-control endpoints do not require a PIN or session. Keep this app reachable only from a trusted network, or protect it at your reverse proxy before exposing it beyond your home network.
