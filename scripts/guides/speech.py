"""Small OpenAI-compatible speech client; never used by the public website."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shlex
import time
from urllib.parse import quote, urlsplit

from common import CACHE, CONFIG, ROOT, content, digest, duration, ffmpeg, write_json


def load_local_env(path=None):
    """Load speech-only settings without shell evaluation or exposing secrets."""
    path = Path(path) if path else ROOT / ".env.guides.local"
    if not path.exists():
        return
    for number, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip().removeprefix("export ")
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        name = name.strip()
        if not separator or not re.fullmatch(r"TTS_[A-Z0-9_]+", name):
            raise ValueError(f"Invalid speech environment setting on line {number}")
        try:
            parts = shlex.split(value, comments=True)
        except ValueError:
            raise ValueError(f"Invalid quoting in speech environment line {number}") from None
        if len(parts) > 1:
            raise ValueError(f"Quote values containing spaces in speech environment line {number}")
        os.environ.setdefault(name, parts[0] if parts else "")


def split_text(text, limit):
    if limit < 1:
        raise ValueError("maxCharacters must be positive")
    if len(text) <= limit:
        return [text]
    sentences = re.split(r"(?<=[.!?。！？؟])\s*", text)
    chunks = []
    current = ""
    for sentence in filter(None, sentences):
        if len(sentence) > limit:
            raise ValueError("A narration sentence exceeds maxCharacters; shorten it in the language file")
        candidate = f"{current} {sentence}".strip()
        if len(candidate) > limit:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def settings(language):
    config = dict(CONFIG["speech"])
    if os.environ.get("TTS_CONFIG"):
        config.update(json.loads(Path(os.environ["TTS_CONFIG"]).read_text()))
    provider = os.environ.get("TTS_PROVIDER", config.get("provider", "openai"))
    if provider not in ("openai", "elevenlabs"):
        raise ValueError("TTS_PROVIDER must be openai or elevenlabs")
    url = os.environ.get("TTS_SPEECH_URL", config.get("url", ""))
    model = os.environ.get("TTS_MODEL", config.get("model", ""))
    voice = config.get("voices", {}).get(language) or os.environ.get("TTS_VOICE", config.get("voice", ""))
    if provider == "elevenlabs":
        model = model or "eleven_multilingual_v2"
        if not voice:
            raise ValueError("Set TTS_VOICE to an ElevenLabs voice ID")
        # Use the native provider's authentication and containerized MP3 output.
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{quote(voice, safe='')}"
        return {**config, "provider": provider, "url": url, "model": model, "voice": voice, "format": "mp3", "language": language.split("-")[0]}
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or not parsed.path.endswith("/audio/speech"):
        raise ValueError("Set TTS_SPEECH_URL to the full /v1/audio/speech or /audio/speech URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Keep credentials in TTS_API_KEY, not in the speech URL")
    if not model or not voice:
        raise ValueError("Set TTS_MODEL and TTS_VOICE (or per-language voices in TTS_CONFIG)")
    return {**config, "provider": provider, "url": url, "model": model, "voice": voice}


def request_audio(payload, config, destination, transport=None, sleep=time.sleep):
    import requests
    post = transport or requests.post
    headers = {"Content-Type": "application/json"}
    elevenlabs = config.get("provider") == "elevenlabs"
    if os.environ.get("TTS_API_KEY"):
        if elevenlabs:
            headers["xi-api-key"] = os.environ["TTS_API_KEY"]
        else:
            headers["Authorization"] = f"Bearer {os.environ['TTS_API_KEY']}"
    elif elevenlabs:
        raise ValueError("Set TTS_API_KEY in .env.guides.local for ElevenLabs")
    request_options = {"params": {"output_format": "mp3_44100_128"}} if elevenlabs else {}
    for attempt in range(config["attempts"]):
        try:
            response = post(config["url"], json=payload, headers=headers, timeout=config["timeoutSeconds"], allow_redirects=False, **request_options)
        except requests.RequestException:
            if attempt + 1 == config["attempts"]:
                raise ValueError("Speech request failed after bounded retries (details omitted to protect credentials)") from None
            sleep(min(2 ** attempt, 10))
            continue
        if response.status_code == 429 or response.status_code >= 500:
            if attempt + 1 < config["attempts"]:
                retry_after = response.headers.get("Retry-After", "")
                sleep(min(float(retry_after), 30) if retry_after.isdigit() else min(2 ** attempt, 10))
                continue
        if not 200 <= response.status_code < 300:
            code = ""
            try:
                detail = json.loads(response.content).get("detail", {})
                known = {"quota_exceeded", "missing_permissions", "invalid_api_key", "voice_not_found", "model_not_found", "payment_required", "paid_plan_required", "insufficient_credits"}
                status = next((value for value in (detail.get("code"), detail.get("status")) if value in known), None)
                if status:
                    code = f" ({status})"
            except (ValueError, AttributeError, TypeError):
                pass
            hint = " Choose an eligible premade voice or a plan that allows this voice." if elevenlabs and code == " (paid_plan_required)" else ""
            raise ValueError(f"Speech endpoint returned HTTP {response.status_code}{code}; response body omitted.{hint}")
        if not response.content or "json" in response.headers.get("Content-Type", ""):
            raise ValueError("Speech endpoint did not return an audio file")
        destination.write_bytes(response.content)
        return
    raise ValueError("Speech request exhausted retries")


def synthesize(guide, language, config):
    results = {}
    for step in guide["steps"]:
        text = step.get("spoken", step["text"])
        options = dict(config.get("options", {}))
        if {"input", "model", "voice", "response_format", "text", "model_id", "language_code"} & options.keys():
            raise ValueError("Speech options cannot replace input, model, voice, or response_format")
        identity = {"input": text, "language": language, "provider": config["url"], "model": config["model"], "voice": config["voice"], "format": config["format"], "options": options}
        key = digest(identity)
        directory = CACHE / "speech/clips" / key
        directory.mkdir(parents=True, exist_ok=True)
        clip = directory / "audio.wav"
        if not clip.exists():
            chunks = split_text(text, config["maxCharacters"])
            normalized = []
            for index, chunk in enumerate(chunks):
                payload = {"model": config["model"], "voice": config["voice"], "input": chunk, "response_format": config["format"], **options}
                if config.get("provider") == "elevenlabs":
                    payload = {"text": chunk, "model_id": config["model"], **options}
                    if config["model"] != "eleven_multilingual_v2":
                        payload["language_code"] = config["language"]
                raw = directory / f"part-{index}.{config['format']}"
                request_audio(payload, config, raw)
                # WAV input and output must differ, even when the provider returned WAV.
                output = directory / f"normalized-{index}.wav"
                ffmpeg("-i", raw, "-vn", "-ac", "1", "-ar", "48000", "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", output)
                if duration(output) <= 0:
                    raise ValueError(f"Empty speech clip for {step['id']}")
                normalized.append(output)
            inputs = [arg for path in normalized for arg in ("-i", str(path))]
            filters = "".join(f"[{i}:a]" for i in range(len(normalized))) + f"concat=n={len(normalized)}:v=0:a=1[a]"
            temporary = directory / "pending.wav"
            ffmpeg(*inputs, "-filter_complex", filters, "-map", "[a]", temporary)
            if duration(temporary) <= 0:
                raise ValueError("Invalid synthesized audio")
            temporary.replace(clip)
        results[step["id"]] = {"key": key, "path": str(clip), "duration": duration(clip), "text": text}
        print(f"  speech {language}/{guide['id']}/{step['id']}: {results[step['id']]['duration']:.1f}s")
    write_json(CACHE / "speech" / language / f"{guide['id']}.json", {"contentHash": digest(guide), "model": config["model"], "voice": config["voice"], "steps": results})


def narrate(languages, guide_id=None):
    for language in languages:
        config = settings(language)
        for guide in content(language):
            if not guide_id or guide["id"] == guide_id:
                synthesize(guide, language, config)
