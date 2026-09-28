#!/usr/bin/env python3
"""Local-only capture, synthesis, and publication entry point."""
import argparse
import os
from pathlib import Path
import sys

from common import CACHE, CONFIG, content, preflight_encoders


def main():
    from speech import load_local_env
    load_local_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["capture", "narrate", "render", "check"])
    parser.add_argument("--guide", choices=[g["id"] for g in content()])
    parser.add_argument("--languages", default=",".join(CONFIG["defaults"]["languages"]))
    parser.add_argument("--api-levels", default=",".join(map(str, CONFIG["defaults"]["apiLevels"])))
    parser.add_argument("--themes", default=",".join(CONFIG["defaults"]["themes"]))
    parser.add_argument("--apk")
    parser.add_argument("--serial", help="Capture an attached phone's installed APK in a disposable Android user")
    parser.add_argument("--resource-tag")
    parser.add_argument("--app-repo", default=str(Path.home() / "git/connectbot"))
    parser.add_argument("--narration", choices=["auto", "required", "off"], default="auto")
    parser.add_argument("--capture-only", action="store_true")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("FFMPEG"):
        import imageio_ffmpeg
        os.environ["FFMPEG"] = imageio_ffmpeg.get_ffmpeg_exe()
    languages = list(dict.fromkeys(args.languages.split(",")))
    apis = list(dict.fromkeys(map(int, args.api_levels.split(","))))
    themes = list(dict.fromkeys(args.themes.split(",")))
    if not set(themes) <= {"light", "dark"}:
        parser.error("--themes accepts light,dark")
    if args.command == "check":
        preflight_encoders()
        for locale in languages:
            content(locale)
        print("Guide prose and encoder prerequisites are valid.")
    elif args.command == "narrate":
        from speech import narrate
        narrate(languages, args.guide)
    else:
        from render import render
        if args.command == "capture":
            from capture import capture
            if not args.capture_only:
                preflight_encoders()
            capture(languages, apis, themes, args.guide, args.apk, args.resource_tag, args.app_repo, args.serial)
            if args.serial:
                from capture import Phone
                apis = [Phone(args.serial).api]
        if not args.capture_only:
            render(languages, apis, themes, args.guide, args.narration)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Subprocess stderr is useful for SDK/encoder diagnostics, but HTTP client
        # errors are sanitized in speech.py before reaching here.
        print(f"Guide pipeline failed: {error}", file=sys.stderr)
        if hasattr(error, "stderr"):
            print(error.stderr, file=sys.stderr)
        sys.exit(1)
