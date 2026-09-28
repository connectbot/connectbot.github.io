import json
import os
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import content, digest, ffmpeg, webvtt, write_json
from render import render_capture, timeline
from speech import load_local_env, request_audio, settings, split_text, synthesize
from capture import Emulator, Phone


class DeviceIsolationTests(unittest.TestCase):
    def test_user_switch_prevents_any_data_reset(self):
        device = object.__new__(Emulator)
        device.user, device.api = 11, 37
        calls = []
        def shell(*args):
            calls.append(args)
            return "0"
        device.shell = shell
        with self.assertRaisesRegex(ValueError, "refusing to clear"):
            device.reset_app()
        self.assertEqual(calls, [("am", "get-current-user")])

    def test_reset_and_permission_grant_are_scoped_to_capture_user(self):
        device = object.__new__(Emulator)
        device.user, device.api = 11, 37
        calls = []
        def shell(*args):
            calls.append(args)
            return "11" if args == ("am", "get-current-user") else "Success"
        device.shell = shell
        device.reset_app()
        self.assertIn(("pm", "clear", "--user", "11", "org.connectbot"), calls)
        self.assertIn(("pm", "grant", "--user", "11", "org.connectbot", "android.permission.POST_NOTIFICATIONS"), calls)

    def test_remote_shell_preserves_user_names_as_one_argument(self):
        device = object.__new__(Emulator)
        with patch.object(device, "adb", return_value="created") as adb:
            device.shell("pm", "create-user", "--ephemeral", "ConnectBot guide captures")
        adb.assert_called_once_with("shell", "pm create-user --ephemeral 'ConnectBot guide captures'")

    def test_phone_cleanup_accepts_android_removing_ephemeral_user(self):
        device = object.__new__(Phone)
        device.user, device.original_user = 18, 0
        present = True
        def shell(*args):
            nonlocal present
            if args == ("pm", "list", "users"):
                return "UserInfo{18:ConnectBot guide captures:2550}" if present else "UserInfo{0:Kenny:4c13}"
            if args == ("am", "stop-user", "-w", "18"):
                present = False
                raise subprocess.CalledProcessError(224, args)
            return ""
        device.shell = shell
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            device.marker = Path(directory) / "phone-user.json"
            device.marker.write_text("{}")
            device.__exit__(None, None, None)
            self.assertFalse(device.marker.exists())

    def test_phone_cleanup_keeps_marker_when_user_remains(self):
        device = object.__new__(Phone)
        device.user, device.original_user = 18, 0
        def shell(*args):
            if args == ("pm", "list", "users"):
                return "UserInfo{18:ConnectBot guide captures:2550}"
            if args == ("am", "stop-user", "-w", "18"):
                raise subprocess.CalledProcessError(1, args)
            return ""
        device.shell = shell
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            device.marker = Path(directory) / "phone-user.json"
            device.marker.write_text("{}")
            with self.assertRaises(subprocess.CalledProcessError):
                device.__exit__(None, None, None)
            self.assertTrue(device.marker.exists())


class TimelineTests(unittest.TestCase):
    def setUp(self):
        self.capture = {"steps": [
            {"id": "first", "startSeconds": 1, "endSeconds": 5, "holdStartSeconds": 4},
            {"id": "second", "startSeconds": 5, "endSeconds": 8, "holdStartSeconds": 7},
        ], "events": [{"time": 2, "x": 30, "y": 40}, {"time": 5.5, "x": 60, "y": 70}]}

    def test_long_narration_extends_step_and_moves_following_chapters(self):
        steps = timeline(self.capture, {"steps": {"first": {"duration": 6}, "second": {"duration": 1}}})
        self.assertAlmostEqual(steps[0]["endSeconds"], 6.6)
        self.assertAlmostEqual(steps[0]["extension"], 2.6)
        self.assertAlmostEqual(steps[1]["startSeconds"], 6.6)
        self.assertEqual(steps[0]["events"][0]["time"], 1)
        self.assertEqual(steps[1]["events"][0]["time"], .5)
        self.assertEqual(steps[1]["extension"], 0)

    def test_silent_timeline_trims_recording_lead_in(self):
        steps = timeline(self.capture)
        self.assertEqual([s["startSeconds"] for s in steps], [0, 4])
        self.assertEqual(steps[-1]["endSeconds"], 7)

    def test_rejects_invalid_static_hold(self):
        self.capture["steps"][0]["holdStartSeconds"] = 6
        with self.assertRaisesRegex(ValueError, "Invalid capture"):
            timeline(self.capture)

    def test_vtt_escapes_markup_and_supports_hour_timecodes(self):
        text = webvtt([(3600, 3601.25, "<Open> & tap")])
        self.assertIn("01:00:00.000 --> 01:00:01.250", text)
        self.assertIn("&lt;Open&gt; &amp; tap", text)

    def test_content_has_unique_stable_steps(self):
        self.assertEqual(len(content()), 3)
        for guide in content():
            self.assertEqual(len({s["id"] for s in guide["steps"]}), len(guide["steps"]))


class SpeechTests(unittest.TestCase):
    def test_local_env_is_not_executed_and_preserves_exported_values(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"TTS_VOICE": "exported"}, clear=True):
            path = Path(directory) / ".env.guides.local"
            path.write_text('TTS_VOICE=file\nTTS_API_KEY="literal-$(echo nope)"\n')
            load_local_env(path)
            self.assertEqual(os.environ["TTS_VOICE"], "exported")
            self.assertEqual(os.environ["TTS_API_KEY"], "literal-$(echo nope)")

    def test_elevenlabs_uses_native_url_authentication_and_output_format(self):
        with patch.dict(os.environ, {"TTS_PROVIDER": "elevenlabs", "TTS_VOICE": "voice-id", "TTS_API_KEY": "test-only"}, clear=True), tempfile.TemporaryDirectory() as directory:
            config = settings("es")
            self.assertEqual(config["url"], "https://api.elevenlabs.io/v1/text-to-speech/voice-id")
            self.assertEqual(config["model"], "eleven_multilingual_v2")
            response = type("Response", (), {"status_code": 200, "content": b"audio", "headers": {"Content-Type": "audio/mpeg"}})()
            with patch("requests.post", return_value=response) as post:
                request_audio({"text": "Hola", "model_id": config["model"]}, config, Path(directory) / "audio.mp3")
            kwargs = post.call_args.kwargs
            self.assertEqual(kwargs["headers"]["xi-api-key"], "test-only")
            self.assertNotIn("Authorization", kwargs["headers"])
            self.assertEqual(kwargs["params"], {"output_format": "mp3_44100_128"})

    def test_sentence_splitting_preserves_text(self):
        self.assertEqual(split_text("First step. Second step. Third step.", 24), ["First step. Second step.", "Third step."])
        self.assertEqual(split_text("افتح القائمة. اختر الإعدادات.", 18), ["افتح القائمة.", "اختر الإعدادات."])
        with self.assertRaises(ValueError):
            split_text("One sentence that is too long", 5)

    def test_both_endpoint_paths_are_preserved(self):
        for path in ("/v1/audio/speech", "/audio/speech", "/proxy/v1/audio/speech"):
            with patch.dict(os.environ, {"TTS_SPEECH_URL": "http://localhost:1234" + path, "TTS_MODEL": "local-tts", "TTS_VOICE": "voice"}, clear=True):
                self.assertEqual(settings("en")["url"], "http://localhost:1234" + path)

    def test_credentials_in_url_are_rejected(self):
        with patch.dict(os.environ, {"TTS_SPEECH_URL": "https://user:secret@example.com/audio/speech", "TTS_MODEL": "test", "TTS_VOICE": "voice"}, clear=True):
            with self.assertRaisesRegex(ValueError, "credentials"):
                settings("en")

    def test_requests_retry_transient_errors_without_requiring_auth(self):
        class Response:
            def __init__(self, code):
                self.status_code = code
                self.content = b"audio"
                self.headers = {"Content-Type": "audio/wav", "Retry-After": "0"}

        calls = []

        def transport(url, **kwargs):
            calls.append((url, kwargs))
            return Response(429 if len(calls) == 1 else 200)

        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            path = Path(directory) / "speech.wav"
            request_audio({"input": "Hello"}, {"url": "http://localhost/audio/speech", "attempts": 3, "timeoutSeconds": 1}, path, transport, lambda _: None)
            self.assertEqual(path.read_bytes(), b"audio")
            self.assertEqual(len(calls), 2)
            self.assertNotIn("Authorization", calls[0][1]["headers"])
            self.assertFalse(calls[0][1]["allow_redirects"])

    def test_http_errors_do_not_expose_provider_body(self):
        response = type("Response", (), {"status_code": 401, "content": b"secret", "headers": {}})()
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "HTTP 401") as error:
                request_audio({}, {"url": "http://localhost/audio/speech", "attempts": 3, "timeoutSeconds": 1}, Path(directory) / "audio", lambda *args, **kwargs: response)
            self.assertNotIn("secret", str(error.exception))

    def test_voice_plan_restriction_is_reported_without_retrying(self):
        response = type("Response", (), {"status_code": 402, "content": b'{"detail":{"status":"payment_required","code":"paid_plan_required","message":"secret"}}', "headers": {}})()
        calls = []
        def transport(*args, **kwargs):
            calls.append(args)
            return response
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"TTS_API_KEY": "test-only"}, clear=True):
            with self.assertRaisesRegex(ValueError, "paid_plan_required.*premade voice") as error:
                request_audio({}, {"provider": "elevenlabs", "url": "https://api.elevenlabs.io/v1/text-to-speech/voice", "attempts": 3, "timeoutSeconds": 1}, Path(directory) / "audio", transport)
            self.assertEqual(len(calls), 1)
            self.assertNotIn("secret", str(error.exception))

    def test_json_instead_of_audio_is_rejected(self):
        response = type("Response", (), {"status_code": 200, "content": b"{}", "headers": {"Content-Type": "application/json"}})()
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "audio file"):
                request_audio({}, {"url": "http://localhost/audio/speech", "attempts": 1, "timeoutSeconds": 1}, Path(directory) / "audio", lambda *args, **kwargs: response)

    def test_cache_identity_changes_with_voice_and_text(self):
        original = {"input": "Hello", "voice": "one", "language": "en"}
        self.assertNotEqual(digest(original), digest({**original, "voice": "two"}))
        self.assertNotEqual(digest(original), digest({**original, "input": "Hi"}))

    def test_synthesis_reuses_cache_and_regenerates_only_changed_steps(self):
        import imageio_ffmpeg
        with tempfile.TemporaryDirectory() as directory, patch("speech.CACHE", Path(directory)), patch.dict(os.environ, {"FFMPEG": imageio_ffmpeg.get_ffmpeg_exe()}):
            calls = []

            def generate(payload, config, destination):
                calls.append(payload["input"])
                ffmpeg("-f", "lavfi", "-i", "sine=frequency=440:duration=0.15", destination)

            config = {"url": "http://localhost/audio/speech", "model": "test", "voice": "test", "format": "wav", "options": {}, "maxCharacters": 3500}
            guide = {"id": "sample", "steps": [{"id": "one", "text": "First."}, {"id": "two", "text": "Second."}]}
            with patch("speech.request_audio", generate):
                synthesize(guide, "en", config)
                synthesize(guide, "en", config)
                guide["steps"][1]["text"] = "Changed."
                synthesize(guide, "en", config)
            self.assertEqual(calls, ["First.", "Second.", "Changed."])
            self.assertTrue((Path(directory) / "speech/en/sample.json").exists())


class RenderIntegrationTests(unittest.TestCase):
    def test_real_encoding_publishes_chapters_and_matching_codec_timelines(self):
        import imageio_ffmpeg
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"FFMPEG": imageio_ffmpeg.get_ffmpeg_exe()}):
            root = Path(directory)
            capture_dir = root / "capture"
            capture_dir.mkdir()
            guide = content()[1]
            steps = []
            for index, step in enumerate(guide["steps"]):
                Image.new("RGB", (180, 320), "navy").save(capture_dir / f"{step['id']}.png")
                steps.append({"id": step["id"], "startSeconds": index, "endSeconds": index + 1, "holdStartSeconds": index + .8, "image": f"{step['id']}.png", "hotspot": {"x": .1, "y": .1, "width": .2, "height": .1}})
            # Android omits unchanged tail frames: the declared final hold runs
            # longer than the source recording and must survive rendering.
            ffmpeg("-f", "lavfi", "-i", "color=c=navy:s=180x320:r=30:d=3.3", "-c:v", "libx264", capture_dir / "raw.mp4")
            write_json(capture_dir / "capture.json", {"guide": guide["id"], "language": "en", "apiLevel": 36, "theme": "light", "width": 180, "height": 320, "appVersion": "test", "provenance": {}, "steps": steps, "events": [{"time": .4, "x": 50, "y": 50}]})
            with patch("render.CACHE", root), patch("render.PUBLIC", root / "public"):
                render_capture(capture_dir, "off")
                index = json.loads((root / "public/index.json").read_text())
                variant = index["variants"][0]
                self.assertEqual(len(variant["steps"]), 4)
                self.assertAlmostEqual(variant["duration"], 4)
                self.assertFalse(variant["narrated"])
                self.assertEqual((root / "public/index.json").stat().st_mode & 0o777, 0o644)
                published = root / "public" / "add-host/en/api-36/light" / variant["build"]
                self.assertEqual(published.stat().st_mode & 0o777, 0o755)
                self.assertEqual((published / "manifest.json").stat().st_mode & 0o777, 0o644)
                # Inspect the encoded pixels: the cue must precede the input,
                # then disappear rather than linger over the resulting screen.
                for extension in ("mp4", "webm"):
                    for seconds, visible in ((.1, True), (.8, False)):
                        frame = root / f"cue-{extension}-{seconds}.png"
                        ffmpeg("-ss", str(seconds), "-i", published / f"video.{extension}", "-frames:v", "1", frame)
                        pixels = Image.open(frame).convert("RGB").crop((8, 8, 92, 92)).getdata()
                        yellow = sum(r > 180 and g > 140 and b < 110 for r, g, b in pixels)
                        self.assertEqual(yellow > 100, visible)
                clip = root / "speech.wav"
                ffmpeg("-f", "lavfi", "-i", "sine=frequency=440:duration=1.8", clip)
                speech = {"contentHash": digest(guide), "steps": {s["id"]: {"path": str(clip), "duration": 1.8, "text": s["text"]} for s in guide["steps"]}}
                write_json(root / "speech/en/add-host.json", speech)
                render_capture(capture_dir, "required")
                narrated_index = json.loads((root / "public/index.json").read_text())
                narrated = narrated_index["variants"][0]
                self.assertTrue(narrated["narrated"])
                self.assertEqual(len(narrated_index["variants"]), 1)
                self.assertAlmostEqual(narrated["duration"], 9.6)
                self.assertTrue(narrated["captions"].endswith("captions.vtt"))
                speech["contentHash"] = "stale"
                write_json(root / "speech/en/add-host.json", speech)
                with self.assertRaisesRegex(ValueError, "prose changed"):
                    render_capture(capture_dir, "required")
                self.assertEqual(json.loads((root / "public/index.json").read_text()), narrated_index)


if __name__ == "__main__":
    unittest.main()
