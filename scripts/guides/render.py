"""Render chaptered web assets from cached Android captures and optional speech."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import shutil
import tempfile

from common import CACHE, CONFIG, FPS, PUBLIC, content, digest, duration, ffmpeg, guide_content, preflight_encoders, probe, run, webvtt, write_json


def timeline(capture, speech=None):
    steps = []
    position = 0
    for step in capture["steps"]:
        start, end = step["startSeconds"], step["endSeconds"]
        raw_duration = end - start
        if raw_duration <= 0 or not start <= step["holdStartSeconds"] < end:
            raise ValueError(f"Invalid capture interval: {step['id']}")
        spoken = speech["steps"][step["id"]]["duration"] if speech else 0
        # All boundaries are on the 30fps output frame grid.
        frames = math.ceil(max(raw_duration, spoken + .6) * FPS)
        length = frames / FPS
        extension = max(0, length - raw_duration)
        events = []
        for event in capture["events"]:
            if start <= event["time"] < end:
                relative = event["time"] - start
                if event["time"] >= step["holdStartSeconds"]:
                    relative += extension
                events.append({**event, "time": relative})
        steps.append({**step, "rawStart": start, "rawEnd": end, "rawHold": step["holdStartSeconds"], "extension": extension, "startSeconds": position / FPS, "endSeconds": (position + frames) / FPS, "events": events})
        position += frames
    return steps


def validate_manifest(manifest, directory):
    if not manifest["steps"] or manifest["duration"] <= 0:
        raise ValueError("Empty guide media")
    last = 0
    for step in manifest["steps"]:
        if abs(step["startSeconds"] - last) > 1 / FPS or step["endSeconds"] <= step["startSeconds"]:
            raise ValueError("Chapter intervals must be contiguous and increasing")
        last = step["endSeconds"]
        if "hotspot" in step:
            h = step["hotspot"]
            if any(not 0 <= h[key] <= 1 for key in ("x", "y", "width", "height")) or h["width"] <= 0 or h["height"] <= 0 or h["x"] + h["width"] > 1.001 or h["y"] + h["height"] > 1.001:
                raise ValueError("Hotspot is outside the captured image")
    if abs(last - manifest["duration"]) > 1 / FPS:
        raise ValueError("Chapters do not cover the video")
    paths = [manifest[key] for key in ("poster", "webm", "mp4", "chapters")]
    paths.extend(s["image"] for s in manifest["steps"])
    if manifest.get("captions"):
        paths.append(manifest["captions"])
    for url in paths:
        if not (directory / Path(url).name).is_file():
            raise ValueError(f"Missing media asset: {url}")


def ring_image(path):
    from PIL import Image, ImageDraw
    image = Image.new("RGBA", (84, 84))
    draw = ImageDraw.Draw(image)
    draw.ellipse((3, 3, 81, 81), outline=(0, 0, 0, 230), width=9)
    draw.ellipse((7, 7, 77, 77), outline=(255, 216, 50, 255), width=5)
    image.save(path)


def tap_window(event):
    # Give viewers time to find the target before the tap changes the screen.
    # Android recorder startup and remote input add latency, so a cue that
    # starts at the controller's tap timestamp can miss the visible action.
    return max(0, event["time"] - 1.2), event["time"]


def render_segment(capture_dir, step, speech, work):
    identifier = step["id"]
    seconds = step["endSeconds"] - step["startSeconds"]
    hold = step["rawHold"] - step["rawStart"]
    remaining = step["rawEnd"] - step["rawHold"]
    # Split the real video at a declared stable hold. Never stretch gestures or verification waits.
    filters = [
        f"[0:v]fps={FPS},tpad=stop_mode=clone:stop_duration={step.get('rawPadding', 0)},split=2[head][tail]",
        f"[head]trim=start={step['rawStart']}:end={step['rawHold']},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p[a]",
        f"[tail]trim=start={step['rawHold']}:end={step['rawEnd']},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p,tpad=stop_mode=clone:stop_duration={step['extension']},trim=duration={remaining + step['extension']}[b]",
        "[a][b]concat=n=2:v=1:a=0[base]",
    ]
    inputs = ["-i", str(capture_dir / "raw.mp4")]
    output = "base"
    if step["events"]:
        inputs += ["-loop", "1", "-i", str(work / "ring.png")]
        events = step["events"]
        if len(events) > 1:
            filters.append(f"[1:v]split={len(events)}" + "".join(f"[r{i}]" for i in range(len(events))))
        for index, event in enumerate(events):
            marker = f"r{index}" if len(events) > 1 else "1:v"
            cue_start, cue_end = tap_window(event)
            filters.append(f"[{output}][{marker}]overlay=x={event['x'] - 42}:y={event['y'] - 42}:enable='between(t,{cue_start},{cue_end})':shortest=1[v{index}]")
            output = f"v{index}"
    segment = work / f"{identifier}.mkv"
    # Intermediate clips are re-encoded for delivery. High-quality H.264 keeps
    # them small enough to render a full guide on modest temporary storage.
    ffmpeg(*inputs, "-filter_complex", ";".join(filters), "-map", f"[{output}]", "-an", "-t", str(seconds), "-r", str(FPS), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p", segment)
    audio = None
    if speech:
        audio = work / f"{identifier}.wav"
        ffmpeg("-i", speech["steps"][identifier]["path"], "-af", "adelay=300:all=1,apad", "-t", str(seconds), "-ar", "48000", "-ac", "1", audio)
    return segment, audio


def encode(master, audio, steps, output):
    inputs = ["-i", str(master)]
    if audio:
        inputs.extend(["-i", str(audio)])
    boundaries = ",".join(f"{s['startSeconds']:.6f}" for s in steps)
    video = ["-map", "0:v", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2), "-force_key_frames", boundaries]
    audio_options = ["-map", "1:a"] if audio else ["-an"]
    ffmpeg(*inputs, *video, *audio_options, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "28", "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-tune-content", "screen", *(["-c:a", "libopus", "-b:a", "64k"] if audio else []), output / "video.webm")
    ffmpeg(*inputs, *video, *audio_options, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", *(["-c:a", "aac", "-b:a", "96k"] if audio else []), output / "video.mp4")


def publish(directory, manifest):
    """Use immutable build directories; atomically replace the index last."""
    validate_manifest(manifest, directory)
    # Temporary files start private; published static assets must be readable
    # by the dev server and deployment processes running under another user.
    directory.chmod(0o755)
    for asset in directory.iterdir():
        asset.chmod(0o644)
    target = PUBLIC / manifest["guide"] / manifest["language"] / f"api-{manifest['apiLevel']}" / manifest["theme"] / manifest["build"]
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        directory.rename(target)
    else:
        shutil.rmtree(directory)
    index_path = PUBLIC / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"schemaVersion": 1, "variants": []}
    index["variants"] = [v for v in index["variants"] if v["id"] != manifest["id"]] + [manifest]
    index["variants"].sort(key=lambda v: v["id"])
    write_json(index_path, index, mode=0o644)


def render_capture(capture_dir, narration="auto"):
    capture = json.loads((capture_dir / "capture.json").read_text())
    guide = guide_content(capture["guide"])
    speech_path = CACHE / "speech" / capture["language"] / f"{capture['guide']}.json"
    speech = None
    translated = guide
    if narration != "off" and speech_path.exists():
        translated = guide_content(capture["guide"], capture["language"])
        speech = json.loads(speech_path.read_text())
        if speech["contentHash"] != digest(translated):
            raise ValueError("Narration prose changed; rerun narrate:guides before rendering")
    elif narration == "required":
        raise ValueError(f"Missing narration: {speech_path}")
    steps = timeline(capture, speech)
    padding = max(0, steps[-1]["rawEnd"] - duration(capture_dir / "raw.mp4")) + 1 / FPS
    for step in steps:
        step["rawPadding"] = padding
    identifier = f"{capture['guide']}/{capture['language']}/api-{capture['apiLevel']}/{capture['theme']}"
    encoder_version = run([os.environ.get("FFMPEG", "ffmpeg"), "-version"]).splitlines()[0]
    build = digest({"capture": capture, "speech": speech, "renderer": Path(__file__).read_text(), "encoder": encoder_version})[:16]
    base = f"/guides/{identifier}/{build}"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=os.environ.get("GUIDES_RENDER_TMP", CACHE), prefix="render-") as working:
        work = Path(working)
        output = Path(tempfile.mkdtemp(dir=PUBLIC, prefix=".pending-"))
        try:
            ring_image(work / "ring.png")
            segments, audio_segments = [], []
            for step in steps:
                segment, audio = render_segment(capture_dir, step, speech, work)
                segments.append(segment)
                if audio:
                    audio_segments.append(audio)
            # Generated paths contain no user-controlled quotes.
            for name, files in (("video", segments), ("audio", audio_segments)):
                if files:
                    (work / f"{name}.txt").write_text("".join(f"file '{file.name}'\n" for file in files))
            master = work / "master.mkv"
            ffmpeg("-f", "concat", "-safe", "1", "-i", work / "video.txt", "-c", "copy", master)
            audio = None
            if audio_segments:
                audio = work / "narration.wav"
                ffmpeg("-f", "concat", "-safe", "1", "-i", work / "audio.txt", "-c", "copy", audio)
            encode(master, audio, steps, output)
            from PIL import Image
            for index, step in enumerate(steps):
                image = capture_dir / step["image"]
                if index == len(steps) - 1 and (capture_dir / f"{step['id']}-hold.png").exists():
                    image = capture_dir / f"{step['id']}-hold.png"
                Image.open(image).save(output / f"{step['id']}.webp", lossless=True)
            shutil.copyfile(output / f"{steps[0]['id']}.webp", output / "poster.webp")
            by_id = {s["id"]: s for s in guide["steps"]}
            (output / "chapters.vtt").write_text(webvtt([(s["startSeconds"], s["endSeconds"], by_id[s["id"]]["title"]) for s in steps]))
            if speech:
                (output / "captions.vtt").write_text(webvtt([(s["startSeconds"] + .3, s["startSeconds"] + .3 + speech["steps"][s["id"]]["duration"], speech["steps"][s["id"]]["text"]) for s in steps]))
            manifest = {key: capture[key] for key in ("guide", "language", "apiLevel", "theme", "width", "height", "appVersion")}
            manifest.update({"id": identifier, "build": build, "duration": steps[-1]["endSeconds"], "poster": f"{base}/poster.webp", "webm": f"{base}/video.webm", "mp4": f"{base}/video.mp4", "chapters": f"{base}/chapters.vtt", "narrated": bool(speech), "transcript": translated["steps"] if speech else [], "steps": [{"id": s["id"], "startSeconds": s["startSeconds"], "endSeconds": s["endSeconds"], "image": f"{base}/{s['id']}.webp", **({"hotspot": s["hotspot"]} if "hotspot" in s else {})} for s in steps]})
            if speech:
                manifest["captions"] = f"{base}/captions.vtt"
            report = {"provenance": capture["provenance"], "ffmpeg": run([os.environ.get("FFMPEG", "ffmpeg"), "-version"]).splitlines()[0], "encodings": {}}
            for extension in ("mp4", "webm"):
                path = output / f"video.{extension}"
                info = probe(path)
                actual = float(info["format"]["duration"])
                if abs(actual - manifest["duration"]) > .15:
                    raise ValueError(f"{extension} duration differs from timeline")
                packets = json.loads(run([os.environ.get("FFPROBE", "ffprobe"), "-v", "error", "-select_streams", "v:0", "-show_packets", "-show_entries", "packet=pts_time,duration_time,flags", "-of", "json", path]))["packets"]
                video_end = max(float(p["pts_time"]) + float(p.get("duration_time", 1 / FPS)) for p in packets)
                if abs(video_end - manifest["duration"]) > .15:
                    raise ValueError(f"{extension} video track does not cover the complete timeline")
                keys = [float(p["pts_time"]) for p in packets if "K" in p.get("flags", "")]
                if any(min(abs(k - s["startSeconds"]) for k in keys) > 1 / FPS + .001 for s in steps):
                    raise ValueError(f"{extension} is missing a chapter keyframe")
                report["encodings"][extension] = {"bytes": path.stat().st_size, "duration": actual, "bitrate": info["format"].get("bit_rate"), "keyframes": keys}
            write_json(output / "manifest.json", manifest)
            write_json(output / "report.json", report)
            write_json(output / "events.json", [{**e, "time": e["time"] + s["startSeconds"]} for s in steps for e in s["events"]])
            publish(output, manifest)
            print(f"Published {identifier} ({'narrated' if speech else 'silent'})", flush=True)
        finally:
            if output.exists():
                shutil.rmtree(output)


def render(languages, apis, themes, guide_id=None, narration="auto"):
    preflight_encoders()
    found = 0
    for path in sorted((CACHE / "captures").glob("*/*/api-*/*/capture.json")):
        data = json.loads(path.read_text())
        if ".pending" in path.parent.name:
            continue
        if data["language"] in languages and data["apiLevel"] in apis and data["theme"] in themes and (not guide_id or data["guide"] == guide_id):
            print(f"Rendering {path.parent.relative_to(CACHE)}", flush=True)
            render_capture(path.parent, narration)
            found += 1
    if not found:
        raise ValueError("No matching captures. Run capture:guides first.")
