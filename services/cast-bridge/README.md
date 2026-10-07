# Chromecast sidecar

This Python 3.11+ service provides a narrow local bridge from the Next.js server to Chromecast devices. PyChromecast handles mDNS discovery and Cast playback commands. The bridge binds to `127.0.0.1` only; it does not accept caller supplied hosts, IP addresses, media URLs, or Cast payloads.

## Install and run

Install the pinned [PyChromecast](https://github.com/home-assistant-libs/pychromecast) dependency in a dedicated Python 3.11+ environment on `server01`:

```sh
python -m pip install -r requirements.txt
```

Set a private token shared only by the Next.js server and sidecar. Generate one with:

```sh
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Then run:

```sh
export CAST_BRIDGE_TOKEN='the-generated-value'
python bridge.py
```

The default port is `8765`; optionally set `CAST_BRIDGE_PORT`. The listener address is fixed to `127.0.0.1`. Keep the token in the server's secret environment, never in browser code. The Next.js server should call `http://127.0.0.1:8765` with `Authorization: Bearer <token>`.

## API

Every route requires the bearer token and a `Host` header for `localhost` or `127.0.0.1` on the configured port. Cross-origin access is not enabled.

`GET /devices` returns IDs (Cast UUIDs), names, model names and Cast types. It does not return IP addresses.

`POST /devices/{uuid}/commands` accepts one of these JSON bodies:

```json
{"command":"play"}
{"command":"pause"}
{"command":"stop"}
{"command":"seek","seconds":42.5}
{"command":"volume","level":0.35}
```

Seek is limited to 0 through 86400 seconds and volume to 0 through 1. Unknown fields and commands are rejected. Spotify Connect remains a separate integration; the bridge does not load media.

Discovery requires multicast DNS (mDNS) traffic to work between `server01` and the Cast devices. PyChromecast documents UDP port 5353 and same-subnet discovery requirements; network isolation or blocked multicast can prevent devices from appearing.

## Local validation

```sh
python -m unittest -v
python -m py_compile bridge.py test_bridge.py
```
