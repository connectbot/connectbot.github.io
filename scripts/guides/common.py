"""Shared paths and validated guide content. No API calls at import/build time."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(os.environ.get("GUIDES_CACHE", ROOT / "local/guide-build")).resolve()
PUBLIC = ROOT / "public/guides"
CONFIG = json.loads((Path(__file__).parent / "config.json").read_text())
FPS = 30


def run(args, **kwargs):
    kwargs.setdefault("timeout", 180)
    return subprocess.run([str(a) for a in args], check=True, capture_output=True, text=True, **kwargs).stdout.strip()


def write_json(path: Path, data, *, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False, encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temporary = Path(file.name)
    temporary.chmod(mode)
    temporary.replace(path)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def language_tag(value):
    if not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", value):
        raise ValueError(f"Invalid BCP-47 language tag: {value}")
    return value


def content(language="en"):
    path = ROOT / "src/guides" / f"{language_tag(language)}.json"
    if not path.exists():
        raise ValueError(f"Missing reviewed language file: {path}")
    guides = json.loads(path.read_text())
    for guide in guides:
        ids = [step["id"] for step in guide["steps"]]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate steps in {guide['id']}")
        for step in guide["steps"]:
            if not step["text"].strip() or not step["title"].strip():
                raise ValueError(f"Empty prose: {guide['id']}/{step['id']}")
    if language != "en":
        expected = {g["id"]: [s["id"] for s in g["steps"]] for g in content()}
        actual = {g["id"]: [s["id"] for s in g["steps"]] for g in guides}
        if actual != expected:
            raise ValueError(f"{language} must contain the same guide and step IDs as English")
    return guides


def guide_content(guide_id, language="en"):
    for guide in content(language):
        if guide["id"] == guide_id:
            return guide
    raise ValueError(f"Unknown guide: {guide_id}")


def probe(path):
    return json.loads(run([os.environ.get("FFPROBE", "ffprobe"), "-v", "error", "-show_format", "-show_streams", "-of", "json", path]))


def duration(path):
    return float(probe(path)["format"]["duration"])


def ffmpeg(*args):
    return run([os.environ.get("FFMPEG", "ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", *args], timeout=3600)


def preflight_encoders():
    output = run([os.environ.get("FFMPEG", "ffmpeg"), "-hide_banner", "-encoders"])
    missing = [encoder for encoder in ("libvpx-vp9", "libx264", "libopus", "aac") if encoder not in output]
    if missing:
        raise ValueError(f"FFmpeg is missing {', '.join(missing)}. Set FFMPEG and FFPROBE to a full build; see docs/guides.md.")


def vtt_time(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}"


def webvtt(cues):
    import html
    return "WEBVTT\n\n" + "\n\n".join(
        f"{i + 1}\n{vtt_time(start)} --> {vtt_time(end)}\n{html.escape(text).replace('-->', '→')}"
        for i, (start, end, text) in enumerate(cues)
    ) + "\n"
