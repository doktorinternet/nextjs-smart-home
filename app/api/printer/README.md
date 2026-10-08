# Printer API

Configure these server environment variables:

- `OCTOPRINT_URL`: OctoPrint base URL, such as `http://octoprint.local` (no credentials, query, or fragment).
- `OCTOPRINT_API_KEY`: an OctoPrint API key. It is sent only from the server in the `X-Api-Key` header.
- `CONTROL_PIN_HASH`: a `scrypt$<salt-base64url>$<32-byte-digest-base64url>` hash of the kiosk PIN. Generate a random salt of at least 12 bytes and derive a 32-byte digest with Node's `scrypt` function; keep the PIN out of source control and server logs.
- `CONTROL_AUTH_SECRET`: a random secret of at least 32 bytes used to sign sessions. Keep it in the server's secret store and rotate it to invalidate all sessions.

Routes:

- `GET /api/printer/status` returns the connection state and current job state, details, and progress.
- `POST /api/printer/command` accepts exactly one JSON field, `command`, with `pause`, `resume`, or `cancel`.
- `POST /api/control-auth/login` accepts exactly one JSON field, `pin`. A valid PIN sets a signed, 15-minute `HttpOnly`, `SameSite=Strict` session cookie scoped to `/api`; it is marked `Secure` in production.
- `POST /api/control-auth/logout` clears that cookie.

Pause and resume are sent to OctoPrint as `command: "pause"` with the explicit `action: "pause"` or `action: "resume"`. Cancel is sent as `command: "cancel"`. The explicit action avoids OctoPrint's backwards-compatible default toggle behavior. No start, restart, connection, or arbitrary printer commands are exposed.

The command route validates the signed session before sending any request to OctoPrint. If either control-auth environment variable is missing or invalid, login and commands fail closed with `503`. Configure a rate limit at the reverse proxy for the login route: this app has no shared rate-limit store, so process-local limits would not protect deployments with multiple workers. Use HTTPS in production; the cookie's `Secure` flag is enabled when `NODE_ENV=production`.
