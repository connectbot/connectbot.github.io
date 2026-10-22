# Terminal keyboard editor

The keyboard library at `/keyboards/` and editor at `/keyboards/editor/` run on
this site's existing static export. Imported files, drafts, and simulated actions
stay in the browser. Community JSON is read from `public/keyboards/` at build time;
see the README there for the pull request workflow.

## Compatibility

The baseline is ConnectBot commit `a754a104`, schema 17. The reference is
`docs/terminal-keyboard.md`, `KeyboardDefaults`, `KeyboardPresets`,
`KeyboardLayers`, `KeyboardRegions`, `KeyboardGrid`, `MacroFormat`, and
`SchemaBasedExporter` in the Android repository. The PNGs under
`app/build/reports/keyboard-presets/` establish preset key order and appearance.

`src/keyboards/model.ts` defines normalized browser types, JSON5 parsing, semantic
validation, and configuration serialization. Wire files use camelCase properties
and integer booleans. Macro documents remain strings, with their independent
version 1 protocol. Unknown row fields and unsupported macro documents survive
import/export. Unsupported keys remain visible but are disabled in test mode.
Malformed structure does not replace the current document; invalid geometry can
be corrected in the inspector or JSON editor and blocks testing/export.

Local drafts and the JSON editor retain unassigned library macros. A downloaded
export contains the selected layout and the closure of its referenced macros.
It never includes host/profile data or keyboard settings. New-copy exports remap
all identities, preserving shared references. Identical repeated downloads reuse
the copy identities until the document or export options change. Preserve UUIDs
is intended for gallery maintenance: ConnectBot skips existing UUIDs, rather than
overwriting them.

## Preview behavior

The shared renderer in `src/components/keyboards/` uses pure geometry calculations
from `src/keyboards/geometry.ts`. All layers and hidden keys reserve geometry.
Pinned regions use independent coordinates; fitted mode appends their columns.
Keys retain row spans when edited, unlike the current Android editor's flattening
behavior. Labels use locally hosted Roboto with its license in `public/fonts/`.

Phone (390×844), tablet (800×1280), and desktop (1440×900) presets describe logical
app and input area dimensions. Orientation sorts/swaps the short and long sides. Custom
sizes range from 240 to 3000 dp. One dp equals one logical CSS pixel before the
whole preview is scaled to fit. The keyboard occupies at most half the console
height remaining above the input method. Phone and tablet previews include a
simulated Google Keyboard (Gboard), with a tablet number row and a shorter
landscape keyboard. The Show Google Keyboard checkbox and test-mode IME toggle
show or hide it. Desktop and custom previews omit it. These preview controls do
not change exported JSON. The simulated keys are decorative; actual Android IME
geometry, device decorations, dynamic colors, and font rendering may differ.

Test mode simulates layers, one-shot/locked modifiers, IME/compose toggles, and
hold-to-repeat. Other app controls are logged. Semantic output is an action log,
not terminal escape encoding or a live shell. Haptic preferences are exported
without vibrating the browser device.

## Checks

- `pnpm check:keyboards`: validate contributed files and built-in templates.
- `pnpm test:keyboards`: Node tests for formats, identity, macros, and geometry.
- `pnpm test:keyboards:browser --project=chromium`: editor/gallery behavior against
  the production export. First build with `pnpm build` and install browsers using
  `PLAYWRIGHT_BROWSERS_PATH=local/playwright pnpm exec playwright install chromium`.
- `pnpm check:types`, `pnpm lint`, and `pnpm build`: standard repository checks.

The production prebuild validates contributions. CI also runs contract tests and
Chromium browser tests. The Playwright configuration retains all three browser
projects; install their binaries to run the keyboard suite across all engines.
