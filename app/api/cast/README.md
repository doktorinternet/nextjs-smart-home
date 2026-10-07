# Cast API facade

The Next.js server exposes a narrow facade for the local Cast bridge. Configure
these server-only environment variables on the Next.js process:

- `CAST_BRIDGE_URL`: `http://127.0.0.1:8765` (or another HTTP URL using only
  `127.0.0.1` or `localhost`, with no path, query, or fragment).
- `CAST_BRIDGE_TOKEN`: the same private bearer token configured as
  `CAST_BRIDGE_TOKEN` for `services/cast-bridge/bridge.py`; it must be at least
  32 characters. Do not prefix either variable with `NEXT_PUBLIC_`.

Routes:

- `GET /api/cast/devices` returns `{ "devices": [...] }` and is not cached.
- `POST /api/cast/devices/{uuid}/commands` requires a valid kiosk control
  session cookie and accepts exactly one of:
  `{"command":"play"}`, `{"command":"pause"}`, `{"command":"stop"}`,
  `{"command":"seek","seconds":42.5}` (0–86400), or
  `{"command":"volume","level":0.35}` (0–1).

The facade builds the bridge paths itself, sends only the fixed bearer token and
validated command fields, and limits calls to loopback URLs. It does not accept
a caller-supplied host, address, URL, or raw bridge payload. Errors returned to
the browser contain no bridge response body or credentials. The bridge must be
running on the same machine as the Next.js server; no live bridge call is needed
to validate this facade.
