"""Synthetic video for player tests only; never published as an Android capture."""
import os
import imageio_ffmpeg
from common import ROOT, ffmpeg

os.environ.setdefault("FFMPEG", imageio_ffmpeg.get_ffmpeg_exe())
directory = ROOT / "local/browser-fixtures"
directory.mkdir(parents=True, exist_ok=True)
for extension, encoder in (("webm", "libvpx-vp9"), ("mp4", "libx264")):
    destination = directory / f"video.{extension}"
    if not destination.exists():
        ffmpeg("-f", "lavfi", "-i", "color=c=navy:s=180x320:r=30:d=6", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "6", "-c:v", encoder, "-pix_fmt", "yuv420p", "-g", "30", "-c:a", "libopus" if extension == "webm" else "aac", destination)
