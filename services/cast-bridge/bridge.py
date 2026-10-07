"""Small, authenticated loopback bridge for Chromecast playback controls."""

from __future__ import annotations

import hmac
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import urlsplit
from uuid import UUID


MAX_BODY_BYTES = 1024
MAX_SEEK_SECONDS = 24 * 60 * 60
DEVICE_PATH = re.compile(r"^/devices/([0-9a-fA-F-]{36})/commands$")


class RequestError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def validate_command(payload: Any) -> tuple[str, float | None]:
    """Validate the complete command document and return its normalized value."""
    if not isinstance(payload, dict) or not isinstance(payload.get("command"), str):
        raise RequestError(400, "Body must be an object with a command string")

    command = payload["command"]
    if command in {"play", "pause", "stop"}:
        if set(payload) != {"command"}:
            raise RequestError(400, "Unexpected command fields")
        return command, None

    if command not in {"seek", "volume"}:
        raise RequestError(400, "Unsupported command")

    field = "seconds" if command == "seek" else "level"
    if set(payload) != {"command", field}:
        raise RequestError(400, f"{command} requires only {field}")
    value = payload[field]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise RequestError(400, f"{field} must be a number")
    value = float(value)
    maximum = float(MAX_SEEK_SECONDS) if command == "seek" else 1.0
    if not 0 <= value <= maximum:
        raise RequestError(400, f"{field} is outside the allowed range")
    return command, value


def canonical_device_id(raw_id: str) -> str:
    try:
        parsed = UUID(raw_id)
    except (ValueError, AttributeError) as exc:
        raise RequestError(400, "Invalid device id") from exc
    normalized = str(parsed)
    if raw_id.lower() != normalized:
        raise RequestError(400, "Invalid device id")
    return normalized


class CastService:
    """Owns discovered devices and exposes only the supported playback actions."""

    def __init__(self, discover: Callable[..., Any] | None = None) -> None:
        self._discover = discover
        self._devices: dict[str, Any] = {}
        self._lock = threading.Lock()
        self._browser: Any = None

    def start_discovery(self) -> None:
        if self._discover is None:
            import pychromecast

            self._discover = pychromecast.get_chromecasts
        # Callback based discovery keeps a single mDNS browser alive.
        self._browser = self._discover(
            blocking=False, callback=self._remember, tries=1, timeout=5
        )

    def _remember(self, cast: Any) -> None:
        device_id = str(cast.uuid)
        try:
            device_id = str(UUID(device_id))
        except ValueError:
            return
        with self._lock:
            self._devices[device_id] = cast

    def devices(self) -> list[dict[str, Any]]:
        with self._lock:
            casts = list(self._devices.items())
        result = []
        for device_id, cast in casts:
            info = cast.cast_info
            result.append(
                {
                    "id": device_id,
                    "name": info.friendly_name or "Chromecast",
                    "model": info.model_name,
                    "type": info.cast_type,
                }
            )
        return sorted(result, key=lambda item: (item["name"].casefold(), item["id"]))

    def command(self, device_id: str, command: str, value: float | None) -> None:
        with self._lock:
            cast = self._devices.get(device_id)
        if cast is None:
            raise RequestError(404, "Device not found")

        media = cast.media_controller
        if command == "play":
            media.play()
        elif command == "pause":
            media.pause()
        elif command == "stop":
            media.stop()
        elif command == "seek":
            media.seek(value)
        elif command == "volume":
            cast.set_volume(value)
        else:
            raise RequestError(400, "Unsupported command")

    def close(self) -> None:
        if self._browser is not None:
            self._browser.stop_discovery()
            self._browser = None
        with self._lock:
            casts = list(self._devices.values())
            self._devices.clear()
        for cast in casts:
            cast.disconnect(timeout=0)


def make_handler(service: CastService, token: str, port: int) -> type[BaseHTTPRequestHandler]:
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}

    class Handler(BaseHTTPRequestHandler):
        server_version = "CastBridge/1.0"

        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def _send(self, status: int, body: dict[str, Any]) -> None:
            data = json.dumps(body, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _authorized(self) -> bool:
            host = self.headers.get("Host", "").lower()
            auth = self.headers.get("Authorization", "")
            expected = f"Bearer {token}"
            if host not in allowed_hosts or not hmac.compare_digest(auth, expected):
                self._send(401, {"error": "Unauthorized"})
                return False
            return True

        def do_GET(self) -> None:
            if not self._authorized():
                return
            if urlsplit(self.path).path != "/devices" or self.path != "/devices":
                self._send(404, {"error": "Not found"})
                return
            self._send(200, {"devices": service.devices()})

        def do_POST(self) -> None:
            if not self._authorized():
                return
            match = DEVICE_PATH.fullmatch(urlsplit(self.path).path)
            if match is None or self.path != urlsplit(self.path).path:
                self._send(404, {"error": "Not found"})
                return
            try:
                device_id = canonical_device_id(match.group(1))
                if self.headers.get("Transfer-Encoding"):
                    raise RequestError(400, "Transfer encoding is not supported")
                length_text = self.headers.get("Content-Length")
                if length_text is None or not length_text.isdigit():
                    raise RequestError(400, "A valid Content-Length is required")
                length = int(length_text)
                if length > MAX_BODY_BYTES:
                    raise RequestError(413, "Request body is too large")
                raw = self.rfile.read(length)
                payload = json.loads(raw.decode("utf-8"))
                command, value = validate_command(payload)
                service.command(device_id, command, value)
            except RequestError as exc:
                self._send(exc.status, {"error": str(exc)})
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._send(400, {"error": "Body must be valid JSON"})
            except Exception:
                self._send(502, {"error": "Cast command failed"})
            else:
                self._send(200, {"ok": True})

    return Handler


def main() -> None:
    token = os.environ.get("CAST_BRIDGE_TOKEN", "")
    if len(token) < 32:
        raise SystemExit("CAST_BRIDGE_TOKEN must contain at least 32 characters")
    try:
        import pychromecast  # noqa: F401
    except ImportError as exc:
        raise SystemExit("Install PyChromecast in the service environment first") from exc

    port = int(os.environ.get("CAST_BRIDGE_PORT", "8765"))
    if not 1 <= port <= 65535:
        raise SystemExit("CAST_BRIDGE_PORT must be between 1 and 65535")
    service = CastService()
    service.start_discovery()
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(service, token, port))
    server.daemon_threads = True
    try:
        print(f"Cast Bridge listening on http://127.0.0.1:{port}")
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        service.close()


if __name__ == "__main__":
    main()
