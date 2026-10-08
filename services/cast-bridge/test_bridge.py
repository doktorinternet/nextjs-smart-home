"""Local input validation checks; no network discovery or device commands."""

import unittest
from uuid import UUID

from bridge import CastService, RequestError, canonical_device_id, validate_command


class CommandValidationTests(unittest.TestCase):
    def test_simple_commands_accept_only_command(self):
        for command in ("play", "pause", "stop"):
            self.assertEqual(validate_command({"command": command}), (command, None))

    def test_seek_and_volume_ranges(self):
        self.assertEqual(validate_command({"command": "seek", "seconds": 12.5}), ("seek", 12.5))
        self.assertEqual(validate_command({"command": "volume", "level": 0.5}), ("volume", 0.5))
        for payload in (
            {"command": "seek", "seconds": -1},
            {"command": "seek", "seconds": 86401},
            {"command": "volume", "level": 1.1},
            {"command": "volume", "level": True},
        ):
            with self.subTest(payload=payload), self.assertRaises(RequestError):
                validate_command(payload)

    def test_rejects_unknown_fields_and_commands(self):
        for payload in (
            {"command": "play", "media_url": "http://example.invalid/a.mp4"},
            {"command": "raw", "payload": {}},
            ["play"],
        ):
            with self.subTest(payload=payload), self.assertRaises(RequestError):
                validate_command(payload)

    def test_device_id_must_be_a_uuid(self):
        expected = "12345678-1234-5678-1234-567812345678"
        self.assertEqual(canonical_device_id(expected), expected)
        with self.assertRaises(RequestError):
            canonical_device_id("192.168.1.2")

    def test_service_dispatches_only_validated_actions_to_selected_cast(self):
        class Media:
            def __init__(self):
                self.calls = []

            def play(self):
                self.calls.append(("play", None))

            def pause(self):
                self.calls.append(("pause", None))

            def stop(self):
                self.calls.append(("stop", None))

            def seek(self, seconds):
                self.calls.append(("seek", seconds))

        class Cast:
            uuid = UUID("12345678-1234-5678-1234-567812345678")

            def __init__(self):
                self.media_controller = Media()
                self.volumes = []

            def set_volume(self, level):
                self.volumes.append(level)

        service = CastService()
        cast = Cast()
        service._remember(cast)
        device_id = str(cast.uuid)
        for command, value in (("play", None), ("pause", None), ("stop", None), ("seek", 5.0), ("volume", 0.4)):
            service.command(device_id, command, value)
        self.assertEqual(cast.media_controller.calls, [("play", None), ("pause", None), ("stop", None), ("seek", 5.0)])
        self.assertEqual(cast.volumes, [0.4])
        with self.assertRaises(RequestError):
            service.command("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "play", None)


if __name__ == "__main__":
    unittest.main()
