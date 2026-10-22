# Share a ConnectBot terminal keyboard

Create or import your layout at https://connectbot.org/keyboards/editor/ and choose
**Share your layout**. Download the JSON, then use GitHub's **Add file → Upload
files** here. GitHub will guide you through forking the repository and opening a
pull request against `develop`.

One file is all you need: `<short-descriptive-name>.json`. The gallery discovers
JSON files here automatically; no index or screenshot needs updating. The layout
name inside the JSON becomes its gallery title. Credit and discussion remain in
the pull request and the file's Git history, linked from the gallery.

## Before opening the pull request

- Include exactly one named layout and only its keys and referenced named macros.
- Export a **new copy** for a new contribution, so its UUIDs do not collide with
  another layout. Preserve UUIDs when maintaining an existing contributed file.
- Use standard JSON, containing only `version`, `keyboard_layouts`,
  `keyboard_macros`, and `keyboard_items`. Exported boolean fields must use integer
  `0`/`1` values. Do not contribute host configurations.
- Test the layout at phone and tablet sizes in portrait and landscape. Check layer
  navigation, shortcuts, hidden keys, and pinned controls.
- Import the downloaded file into a current ConnectBot build via **Import Hosts**,
  then select it under **Settings → Terminal keyboard**.
- Describe the intended workflow and any noteworthy macros in your pull request.
  Use generic example text in macros. All contributed content is public.

The website checks files against the current keyboard contract during CI and the
production build. Run `pnpm check:keyboards` locally to see diagnostics. Compatibility
is based on ConnectBot schema 17, commit `a754a104`.

For existing layouts, ConnectBot skips records whose UUIDs already exist. Updating
a gallery file does not overwrite an installed copy; users can customize and
export it as a new copy when they want to import the updated version.
