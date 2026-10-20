# Authoring feature guides

The capture pipeline uses real Android screens, recorded actions, chapter links,
yellow tap cues, and optional narration. Defaults are English, Android API 36,
and both light and dark themes. Generated assets live in `public/guides/`;
Android captures and speech caches live in ignored `local/guide-build/`.

## 1. Install the capture tools

Install `uv`, the Android SDK command-line tools, platform-tools, emulator, and
`ffprobe`. Set `ANDROID_SDK_ROOT` to your SDK directory. Python dependencies and
an FFmpeg encoder are installed automatically by the guide commands.

```sh
export ANDROID_SDK_ROOT=/path/to/android-sdk
sdkmanager 'system-images;android-36;google_apis;x86_64'
pnpm check:guides
```

The release APK and emulator profiles are configured in
`scripts/guides/config.json`. UI labels come from the matching ConnectBot resource
tag, using `~/git/connectbot` when available. Use `--app-repo` for another checkout.

## 2. Create a capture scenario

Create `scripts/guides/scenarios/my_feature.py`. Each guide has its own file:
`add_host.py`, `special_keys.py`, and `terminal_appearance.py` are working examples.
Export `SEED_LOCAL` and a `run(c)` function, then register the module under the
guide's ID in `scripts/guides/scenarios/__init__.py`.

```python
"""Capture the my-feature walkthrough."""

SEED_LOCAL = False  # True creates a local demo terminal before recording.

def run(c):
    with c.step("open-menu"):
        c.click("button_more_options", description=True)
    with c.step("open-settings"):
        c.click("list_menu_settings")
```

`c.step()` declares a chapter and captures its starting screenshot and settled
ending. Use stable step IDs in the same order as the prose. `c.click()` locates
translated Android string resources and records the tap and target bounds;
`c.click_action()` handles toolbar text or icons. `c.tap(node)` also records a
cue. Use `c.node()` to wait for the expected result, `c.fill()` to enter text,
`c.back()` to navigate, and `c.center_setting()` to reveal a Settings row.
Prefer resource keys and accessibility labels over fixed screen coordinates.
Raw `c.d.click()` calls bypass the tap recording helper.

The shared device setup, screenshot/recording helpers, and cleanup remain in
`scripts/guides/capture.py`. `SEED_LOCAL = True` calls its existing
`seed_local()` helper; add any other scenario-specific preparation deliberately
before recording rather than presenting it as a user instruction.

## 3. Write the step descriptions and add the page

Add a guide object to `src/guides/en.json`. Its ID must match the scenario registry
key, and its step IDs and order must match the `c.step()` calls:

```json
{
  "id": "my-feature",
  "title": "Open ConnectBot settings",
  "description": "Find the app settings from the Host List.",
  "steps": [
    {
      "id": "open-menu",
      "title": "Open the menu",
      "text": "From the Host List, tap the three-dot menu."
    },
    {
      "id": "open-settings",
      "title": "Open Settings",
      "text": "Tap Settings."
    }
  ]
}
```

`text` supplies the written instruction and default speech. An optional `spoken`
field overrides speech for pronunciation, such as spelling out a server address.
Write instructions for the user; avoid describing the capture or narration process.

Add the same guide and step IDs to every existing translation file
(`src/guides/es.json` and `src/guides/ar.json`), with translated titles, descriptions,
and prose. A new language needs a complete `src/guides/<language>.json` containing
all guides with the same IDs and step order as English.

Create `src/content/guides/my-feature.mdx`:

```mdx
---
title: Open ConnectBot settings
---

import { GuideContent } from '@/components/GuideContent';

# Open ConnectBot settings

<GuideContent id="my-feature" />
```

Add the page to `src/content/guides/_meta.ts` and link it from the guide index.
Run `pnpm check:guides --languages en,es,ar` to validate prose and encoders.
The player follows the site's language and theme automatically. Until a matching
recording is published, the page shows only its written instructions.

## 4. Capture the Android interactions

Capture first without rendering, so you can inspect the screenshots and recording:

```sh
pnpm capture:guides --guide my-feature --languages en --api-levels 36 --themes light,dark --capture-only
```

Review `local/guide-build/captures/my-feature/en/api-36/{light,dark}/`:
`raw.mp4`, step PNGs, `capture.json`, and any failure diagnostics. The tool uses
its own disposable emulator and validates that captured steps match the prose.

For a connected phone with ConnectBot already installed:

```sh
adb devices -l
pnpm capture:guides --guide my-feature --serial DEVICE_SERIAL --resource-tag MATCHING_TAG_OR_COMMIT --languages en --themes light,dark --capture-only
```

Phone capture uses a temporary Android user and restores the original user after
cleanup. Keep it unlocked and approve debugging prompts. Its actual API level
replaces `--api-levels`; use that API level when rendering. See
[phone setup and capture details](guides.md#capture-on-a-connected-phone).

## 5. Generate narration

Put speech settings in the ignored root `.env.guides.local`. Choose one provider.
For an OpenAI-compatible endpoint, use its exact speech URL:

```dotenv
TTS_PROVIDER=openai
TTS_SPEECH_URL=http://your-server:1234/v1/audio/speech
TTS_MODEL=your-speech-model
TTS_VOICE=your-voice
TTS_API_KEY=your-api-key
```

`/audio/speech` URLs also work. Omit the key for an unauthenticated service.
For ElevenLabs, use these settings instead:

```dotenv
TTS_PROVIDER=elevenlabs
TTS_MODEL=eleven_v3
TTS_VOICE=your-eligible-voice-id
TTS_API_KEY=your-api-key
```

Keep keys out of git and never use a `NEXT_PUBLIC_` variable for them. Generate
speech from the step prose (or `spoken` override):

```sh
pnpm narrate:guides --guide my-feature --languages en
```

Speech clips are cached and reused across themes and API levels. To add languages,
review their prose first, then run `--languages en,es,ar`. Only changed clips incur
new speech requests. Per-language voice settings and provider details are in
[the speech configuration documentation](guides.md#speech-credentials-and-providers).

## 6. Render and review the video

Render the existing captures using the cached narration:

```sh
pnpm render:guides --guide my-feature --languages en --api-levels 36 --themes light,dark --narration required
pnpm dev
```

Open `/guides/my-feature/`. Check both site themes, tap cue timing, chapters,
subtitles, narration, and the screenshot tour. Rendering creates VP9/WebM and
H.264/MP4 videos, screenshots, captions, chapters, and manifests, then updates
`public/guides/index.json`. Use `--narration off` to render without speech.

For a language/API matrix, install each SDK image and configure each API profile
before capture. Use the same filters for capture and render:

```sh
pnpm capture:guides --guide my-feature --languages en,es,ar --api-levels 29,36 --themes light,dark --capture-only
pnpm narrate:guides --guide my-feature --languages en,es,ar
pnpm render:guides --guide my-feature --languages en,es,ar --api-levels 29,36 --themes light,dark --narration required
```

After editing only prose, rerun narration and rendering; existing captures are
reused. After changing app screens or scripted interactions, recapture before
rendering. Verify the pipeline and site:

```sh
pnpm test:guides
pnpm lint
pnpm build
pnpm test:guides:browser --project chromium --project firefox --workers 1
```

Browser tests require installed Playwright browsers; see
[validation setup](guides.md). Publish the generated index and every asset it
references together with the guide's code and prose. Speech keys, raw captures,
and synthesis caches remain local.

To keep only the current published build for each guide/language/API/theme:

```sh
pnpm prune:guides --dry-run  # Preview obsolete build directories.
pnpm prune:guides           # Delete them, keeping all indexed assets.
pnpm prune:guides --guide special-keys  # Limit cleanup to one guide.
```

Run pruning after rendering finishes, before building or publishing the site. It
keeps every build referenced by `public/guides/index.json`, including both themes,
and leaves raw captures and paid speech caches intact. No additional package
or Android/speech setup is required.
