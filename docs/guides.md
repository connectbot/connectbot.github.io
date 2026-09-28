# Capturing and narrating guides

The website consumes committed media. Android tooling and speech credentials are
needed only when generating media, never by `pnpm build` or readers.

For creating a new scenario, its step descriptions, narration, and video, follow
the [complete authoring workflow in README.md](../README.md#feature-guides). Each
guide has a module in `scripts/guides/scenarios/`; shared capture helpers remain
in `scripts/guides/capture.py`.

## Setup and capture

Install `uv`, an Android SDK with command-line tools, emulator and platform-tools,
and `ffprobe`. Set `ANDROID_SDK_ROOT`. Commands install pinned Python dependencies
into an ignored local cache. A pinned `imageio-ffmpeg` binary supplies VP9, H.264,
Opus and AAC; override with `FFMPEG` and optionally `FFPROBE`.

```sh
sdkmanager 'system-images;android-36;google_apis;x86_64'
pnpm check:guides
pnpm capture:guides
```

Defaults: every guide, English, API 36, **both light and dark**. Capture then
renders silent videos, or narrated ones if valid speech is cached. It boots and
clears app data only in its own AVD, refusing occupied emulator ports. Override port 5580
with `GUIDES_EMULATOR_PORT`. Allow enough disk space for the SDK's userdata image;
`GUIDES_AVD_HOME=/tmp/connectbot-guide-avd` relocates disposable AVD data.

The APK URL/checksum and emulator profiles live in `scripts/guides/config.json`.
The OSS release bundles translations. Selectors use resources from the matching
git tag in `~/git/connectbot`, or fetch that tag when the checkout is unavailable.
Use `--app-repo /path/to/connectbot` for another checkout. An APK override requires
`--apk /path/to/release.apk --resource-tag vX.Y.Z` matching its UI resources.

```sh
sdkmanager 'system-images;android-29;google_apis;x86_64'
pnpm capture:guides --languages en,es,ar --api-levels 29,36
pnpm capture:guides --guide special-keys --themes dark
pnpm capture:guides --capture-only
pnpm render:guides --narration off
```

Add an explicit profile before requesting another API. Profiles specify image,
dimensions, density, navigation and IME environment. Reports record the actual
image fingerprint, APK checksum and encoder version. Install images separately.
Each variant sets its system locale and light/dark mode; fresh app preferences
follow that system theme. Capture checks the empty Host List background before
recording and calculates fresh hotspot bounds for every variant.
Android string-resource fallback is supported; a completely absent locale fails.

### Capture on a connected phone

For Android 13/API 33 or newer, use the already-installed ConnectBot APK and a
resource tag or commit matching that build:

```sh
adb devices -l
pnpm capture:guides --serial DEVICE_SERIAL --resource-tag MATCHING_TAG_OR_COMMIT
```

The phone must support secondary Android users. The tool creates a temporary
user, enables the installed APK there, and clears app data only in that owned
user. It returns to the original user and removes the temporary one afterward.
It does not replace the personal user's APK or hosts. Keep the phone unlocked
and approve any Android debugging prompts. The temporary capture user gets a
longer screen timeout so recordings are not interrupted by the lock screen.
The phone's actual API level and
dimensions are recorded; `--api-levels` applies only to emulator capture.

Phone language variants use per-app locales; the system keyboard retains its
device language. App light/dark preferences change only in the temporary user.
For local debugging, `GUIDES_KEEP_PHONE_USER=1` retains the temporary user and an
ownership record in the capture cache, so the next command can reuse it. Run
without that flag to return to the original user and clean up afterward.

## Prose and translations

`src/guides/en.json` supplies the written instructions and default narration.
Each step has a stable `id`, `title`, and plain `text`. Optional `spoken` replaces
the narration/transcript for pronunciation or punctuation. Do not include MDX
markup in spoken text.

To edit the narration, change a step's `text` (or its `spoken` override), then run:

```sh
pnpm narrate:guides --languages en
pnpm render:guides --narration required
```

Only changed speech clips are regenerated. Prose changes reuse the existing
Android captures; recapture when the screen or interactions change. Keep the
prose focused on what the viewer should do rather than how the demo was recorded.

Add `src/guides/<BCP-47-tag>.json` for another narration language, retaining all
guide and step IDs. Translate and review titles, text and spoken overrides,
including the app's localized labels. Check with
`pnpm check:guides --languages en,<tag>`. Capture works without translated website
prose; narration requires a complete language file and matches the app language.

## Speech credentials and providers

Guide commands automatically read `.env.guides.local` at the repository root.
It is ignored by git and is not loaded by the website. Exported environment
variables take precedence. Values may be quoted; shell expansion is not performed.
Never use `NEXT_PUBLIC_` for speech credentials.

### ElevenLabs

Put these settings in `.env.guides.local`:

```dotenv
TTS_PROVIDER=elevenlabs
TTS_MODEL=eleven_v3
TTS_VOICE=your-voice-id
TTS_API_KEY=your-api-key
```

Use a voice ID available to your API plan; free accounts can use eligible
premade voices, while Voice Library voices require a paid plan. This provider uses the native
`/v1/text-to-speech/{voice_id}` endpoint, `xi-api-key` authentication and MP3
output, then normalizes the result like other speech clips. Eleven v3 uses this
same endpoint with `TTS_MODEL=eleven_v3`. Per-language `voices` in `TTS_CONFIG`
work for this provider too. See the [ElevenLabs API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

```sh
pnpm narrate:guides --languages en
pnpm render:guides --narration required
```

### OpenAI-compatible speech

Configure an exact endpoint, model and voice; there is no automatic provider or
endpoint fallback.

```sh
export TTS_SPEECH_URL=https://your-provider.example/v1/audio/speech
export TTS_PROVIDER=openai
# /audio/speech and proxy prefixes work too.
export TTS_MODEL=your-tts-model
export TTS_VOICE=your-voice
export TTS_API_KEY=your-key # Omit for an unauthenticated local service.
pnpm narrate:guides --languages en
pnpm render:guides --narration required
```

Keep credentials out of git. Requests contain `model`, `voice`, `input`, and
`response_format` (WAV by default). The prose determines the spoken language.
Only explicitly configured provider options are sent. Use `TTS_CONFIG` to name
a local JSON file with overrides, for example:

```json
{
  "format": "mp3",
  "maxCharacters": 3500,
  "timeoutSeconds": 120,
  "attempts": 3,
  "voices": { "en": "voice-en", "es": "voice-es", "ar": "voice-ar" },
  "options": { "speed": 1.0 }
}
```

Use audio formats with a container supported by FFmpeg (WAV, MP3, FLAC, AAC).
Raw PCM is unsupported. Authorization/configuration errors fail immediately;
transient failures get bounded retries. A retry after a timeout may produce
another billed request depending on the provider. Error response bodies and
credentials are not logged or published.

Speech clips are cached by text, language, provider, model, voice and settings,
then reused across themes/APIs. Changing one step regenerates only its clip.
Long text splits at sentence boundaries; shorten sentences exceeding the limit.
Translations are reviewed files, not generated automatically.

## Timing and publication

Capture saves each step's initial screenshot, real interaction video, a stable
tail hold and tap events. Rendering preserves real-time gestures and verification
waits. Long narration extends only stable holds. Chapters, captions, tap markers
and both codec outputs use the resulting timeline. Captions align by step.
Yellow tap cues appear up to 1.2 seconds before each recorded tap, starting no
earlier than its chapter, so viewers can find the target before the screen changes.

Links such as `/guides/special-keys/#watch-open-settings` select a logical step;
every language/API/theme variant owns its timestamps. Chapter starts are forced
keyframes. Variant switches preserve the step rather than a numeric timestamp.
The player follows the site's global theme and page language (`html lang`),
using a regional language's base locale or English when needed. It automatically
uses the newest Android API captured for that language and appearance; there
are no per-guide preference selectors.

Immutable builds live under
`public/guides/<guide>/<language>/api-<level>/<theme>/`. The index is replaced
atomically only after validation. Commit the index and referenced assets together.
Run `pnpm prune:guides --dry-run` to preview obsolete builds, then
`pnpm prune:guides` to remove them. `--guide special-keys` limits cleanup to one
guide. Run it after rendering completes and before building the site; indexed
builds, raw captures, and cached narration are preserved.

Raw recordings, lossless intermediates, speech WAVs and diagnostics stay in
ignored `local/guide-build` (`GUIDES_CACHE` overrides it). Keep this cache to
re-render after prose changes without Android recapture. Failures preserve
screenshots, hierarchy XML and recorder logs in `.pending` capture directories.
Set `GUIDES_RENDER_TMP` to a directory with several gigabytes free to place the
temporary lossless video intermediates on a separate disk.

## Validation

```sh
pnpm test:guides
PLAYWRIGHT_BROWSERS_PATH=local/playwright pnpm exec playwright install
pnpm build
pnpm test:guides:browser
pnpm lint
pnpm check:types
```

Review light/dark videos at phone and desktop sizes: glyphs, tap positions,
scrolling, chapters, captions and speech. Check `report.json` for duration, size,
bitrate, provenance and keyframes. Exercise Spanish and Arabic on APIs 29 and 36
for localized selectors and RTL. Use a real configured speech endpoint for voice
and pronunciation review; mock tests do not spend API credits. Site builds and
deployments use committed media and make no speech requests.

Browser tests serve the static `out` export, so rebuild after changing the player.
On hosts missing a browser's system libraries, install those libraries or run
`pnpm test:guides:browser --project chromium --project firefox` and record that
WebKit remains unverified. Sample translated scripts should receive a native
speaker's wording and pronunciation review before narrated publication.

For local scenario debugging only, `GUIDES_KEEP_EMULATOR=1` leaves the dedicated
AVD running. A subsequent command may reuse it with `GUIDES_REUSE_EMULATOR=1`;
reuse requires both the pipeline's ownership marker and its expected AVD name.
Omit the keep flag on that subsequent run to shut it down when finished.
