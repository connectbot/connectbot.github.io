import JSON5 from 'json5';

export type Layout = { id: string; name: string; buttonWidth: number; buttonHeight: number; fitToWidth: boolean; presetKey: string | null };
export type Item = {
  id: string;
  layoutId: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  visible: boolean;
  kind: string;
  target: string;
  layer: number;
  pinned: boolean;
  backgroundColor: number | null;
  backgroundOpacity: number | null;
  textColor: number | null;
  outlineColor: number | null;
  outlineWidth: number | null;
  repeatOnHold: boolean | null;
  hapticFeedback: boolean | null;
  macroId: string | null;
};
export type Macro = { id: string; name: string; document: string };
export type Configuration = { version: number; layouts: Layout[]; items: Item[]; macros: Macro[] };
export type Action = { type: 'text'; text: string } | { type: 'bytes'; hex: string } | { type: 'key'; key?: string; character?: string; modifiers: string[] };
export const modifiers = ['ctrl', 'alt', 'shift'];
export const appActions = ['text_input', 'toggle_compose', 'toggle_ime', 'paste'];
export const namedKeys = ['enter', 'tab', 'escape', 'backspace', 'delete', 'arrow_up', 'arrow_down', 'arrow_left', 'arrow_right', 'home', 'end', 'insert', 'page_up', 'page_down', ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`), ...Array.from({ length: 10 }, (_, i) => `keypad_${i}`), ...['multiply', 'plus', 'comma', 'minus', 'period', 'divide', 'enter', 'equal'].map(k => `keypad_${k}`)];
export const keys = [...namedKeys, ...Array.from({ length: 95 }, (_, i) => `character_${i + 32}`)];
export const MAX_BYTES = 8 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function newItem(layoutId: string, overrides: Partial<Item> = {}): Item {
  return { id: overrides.id ?? newId(), layoutId, row: 0, column: 0, rowSpan: 1, columnSpan: 1, visible: true, kind: 'key', target: 'escape', layer: 0, pinned: false, backgroundColor: null, backgroundOpacity: null, textColor: null, outlineColor: null, outlineWidth: null, repeatOnHold: null, hapticFeedback: null, macroId: null, ...overrides };
}
export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object.');
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string.`);
  }
  return value;
}
function number(value: unknown, fallback: number, field: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number.`);
  }
  return value;
}
function bool(value: unknown, fallback: boolean, field: string): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0) {
    return false;
  }
  throw new Error(`${field} must be true, false, 0, or 1.`);
}
function nullableNumber(value: unknown, field: string): number | null {
  return value == null ? null : number(value, 0, field);
}
function nullableBool(value: unknown, field: string): boolean | null {
  return value == null ? null : bool(value, false, field);
}
function rows(root: Record<string, unknown>, name: string): Record<string, unknown>[] {
  const value = root[name] ?? [];
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array.`);
  }
  return value.map(row => object(row));
}
export function parseConfiguration(source: string): Configuration {
  if (new TextEncoder().encode(source).length > MAX_BYTES) {
    throw new Error('Files must be 8 MiB or smaller.');
  }
  const root = object(JSON5.parse(source));
  const layouts = rows(root, 'keyboard_layouts').map((r): Layout => ({
    ...r,
    id: text(r.id, 'Layout UUID'),
    name: text(r.name, 'Layout name'),
    buttonWidth: number(r.buttonWidth, 45, 'Button width'),
    buttonHeight: number(r.buttonHeight, 30, 'Button height'),
    fitToWidth: bool(r.fitToWidth, false, 'Fit to width'),
    presetKey: r.presetKey == null ? null : text(r.presetKey, 'Preset'),
  }));
  if (!layouts.length) {
    throw new Error('No keyboard_layouts found. Import a ConnectBot configuration export containing a keyboard.');
  }
  const items = rows(root, 'keyboard_items').map((r): Item => ({
    ...r,
    id: text(r.id, 'Key UUID'),
    layoutId: text(r.layoutId, 'Key layout UUID'),
    row: number(r.row, 0, 'Row'),
    column: number(r.column, 0, 'Column'),
    rowSpan: number(r.rowSpan, 1, 'Row span'),
    columnSpan: number(r.columnSpan, 1, 'Column span'),
    layer: number(r.layer, 0, 'Layer'),
    visible: bool(r.visible, true, 'Visible'),
    pinned: bool(r.pinned, false, 'Pinned'),
    kind: text(r.kind ?? 'key', 'Kind'),
    target: text(r.target ?? 'escape', 'Target'),
    macroId: r.macroId == null ? null : text(r.macroId, 'Macro UUID'),
    backgroundColor: nullableNumber(r.backgroundColor, 'Background color'),
    backgroundOpacity: nullableNumber(r.backgroundOpacity, 'Background opacity'),
    textColor: nullableNumber(r.textColor, 'Text color'),
    outlineColor: nullableNumber(r.outlineColor, 'Outline color'),
    outlineWidth: nullableNumber(r.outlineWidth, 'Outline width'),
    repeatOnHold: nullableBool(r.repeatOnHold, 'Repeat'),
    hapticFeedback: nullableBool(r.hapticFeedback, 'Haptics'),
  }));
  const macros = rows(root, 'keyboard_macros').map((r): Macro => ({ ...r, id: text(r.id, 'Macro UUID'), name: text(r.name, 'Macro name'), document: text(r.document, 'Macro document') }));
  return { version: number(root.version, 17, 'Version'), layouts, items, macros };
}
export function decodeMacro(source: string): Action[] {
  if (source.length > 65536) {
    throw new Error('Macro exceeds 65,536 UTF-16 code units.');
  }
  const root = object(JSON5.parse(source));
  if (root.version !== 1 || Object.keys(root).some(k => !['version', 'actions'].includes(k))) {
    throw new Error('Unsupported macro version or fields.');
  }
  if (!Array.isArray(root.actions) || root.actions.length < 1 || root.actions.length > 256) {
    throw new Error('Macros need 1–256 actions.');
  }
  return root.actions.map((value, index) => decodeAction(value, index));
}
function decodeKeyAction(row: Record<string, unknown>, fail: (message: string) => never): Action {
  if ((row.key === undefined) === (row.character === undefined)) {
    fail('choose exactly one key or character.');
  }
  if (row.key !== undefined && (typeof row.key !== 'string' || !keys.includes(row.key))) {
    fail('unknown key.');
  }
  if (row.character !== undefined && (typeof row.character !== 'string' || [...row.character].length !== 1 || /[\uD800-\uDFFF]/u.test(row.character))) {
    fail('choose one Unicode scalar.');
  }
  if (!Array.isArray(row.modifiers) || row.modifiers.some((m: unknown) => typeof m !== 'string' || !modifiers.includes(m)) || new Set(row.modifiers).size !== row.modifiers.length) {
    fail('unknown or duplicate modifiers.');
  }
  const key = row.key === undefined ? { character: row.character as string } : { key: row.key };
  return { type: 'key', ...key, modifiers: modifiers.filter(m => (row.modifiers as string[]).includes(m)) };
}
function decodeAction(value: unknown, index: number): Action {
  const row = object(value);
  const fail = (message: string): never => {
    throw new Error(`Action ${index + 1}: ${message}`);
  };
  const fields = new Map([
    ['text', ['type', 'text']],
    ['bytes', ['type', 'hex']],
    ['key', ['type', 'key', 'character', 'modifiers']],
  ]);
  const fieldsForType = typeof row.type === 'string' ? fields.get(row.type) : undefined;
  const allowed = fieldsForType ?? fields.get('key')!;
  if (Object.keys(row).some(k => !allowed.includes(k))) {
    fail('unsupported fields.');
  }
  if (row.type === 'text') {
    if (typeof row.text !== 'string' || row.text.length === 0) {
      fail('text cannot be empty.');
    }
    return { type: 'text', text: row.text as string };
  }
  if (row.type === 'bytes') {
    if (typeof row.hex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(row.hex)) {
      fail('hex must contain complete byte pairs, without spaces.');
    }
    return { type: 'bytes', hex: (row.hex as string).toLowerCase() };
  }
  if (row.type !== 'key') {
    fail('unsupported action type.');
  }
  return decodeKeyAction(row, fail);
}

export function encodeMacro(actions: Action[]): string {
  const source = JSON.stringify({ version: 1, actions });
  const canonical = decodeMacro(source);
  return JSON.stringify({ version: 1, actions: canonical });
}
export function populated(items: Item[]): number[] {
  return [...new Set(items.filter(i => i.visible && i.kind !== 'layer').map(i => i.layer))].sort((a, b) => a - b);
}
export function destination(items: Item[], current: number, target: string): number | undefined {
  const layers = populated(items);
  return target === 'next' ? layers.find(l => l > current) ?? layers[0] : layers.find(l => l === Number(target));
}
export function overlaps(a: Item, b: Item): boolean {
  return a.pinned === b.pinned && a.layer === b.layer && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan && a.column < b.column + b.columnSpan && b.column < a.column + a.columnSpan;
}
export function supported(item: Item, items: Item[], macros: Macro[]): boolean {
  if (item.kind === 'layer') {
    return destination(items, item.layer, item.target) !== undefined;
  }
  if (item.kind === 'modifier') {
    return modifiers.includes(item.target);
  }
  if (item.kind === 'app') {
    return appActions.includes(item.target);
  }
  if (item.kind !== 'key' && item.kind !== 'macro') {
    return false;
  }
  if (item.kind === 'key' && !keys.includes(item.target)) {
    return false;
  }
  if (item.kind === 'macro' || item.macroId !== null) {
    const macro = macros.find(m => m.id === item.macroId);
    try {
      if (macro === undefined) {
        return false;
      }
      decodeMacro(macro.document);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
function validateIdentities(config: Configuration, errors: string[]): void {
  for (const records of [config.layouts, config.items, config.macros]) {
    const ids = new Set<string>();
    for (const r of records) {
      if (!uuidPattern.test(r.id)) {
        errors.push(`Invalid canonical UUID: ${r.id}`);
      }
      if (ids.has(r.id)) {
        errors.push(`Duplicate UUID within a keyboard table: ${r.id}`);
      }
      ids.add(r.id);
    }
  }
}
function validateReferences(config: Configuration, errors: string[]): void {
  for (const item of config.items) {
    if (!config.layouts.some(l => l.id === item.layoutId)) {
      errors.push(`Key ${item.id} references a missing layout.`);
    }
    if (item.macroId !== null && !config.macros.some(m => m.id === item.macroId)) {
      errors.push(`Key ${item.id} references a missing macro.`);
    }
  }
}
function validateLayout(layout: Layout, items: Item[], errors: string[]): void {
  const prefix = `${layout.name || 'Unnamed layout'}: `;
  if (!layout.name.trim()) {
    errors.push(`${prefix}a name is required.`);
  }
  if (![layout.buttonWidth, layout.buttonHeight].every(n => Number.isFinite(n) && n > 0 && n <= 1000)) {
    errors.push(`${prefix}button dimensions must be greater than 0 and at most 1000 dp.`);
  }
  if (items.length > 256) {
    errors.push(`${prefix}at most 256 keys are allowed.`);
  }
  items.forEach((item, index) => {
    const p = `${prefix}key ${index + 1}: `;
    if (![item.row, item.column, item.rowSpan, item.columnSpan, item.layer].every(value => Number.isInteger(value)) || item.row < 0 || item.column < 0 || item.rowSpan <= 0 || item.columnSpan <= 0 || item.row + item.rowSpan > 1000 || item.column + item.columnSpan > 1000 || item.layer < 0 || item.layer > 4) {
      errors.push(`${p}invalid position, span, or layer.`);
    }
    if ((item.column + item.columnSpan) * layout.buttonWidth > 3000 || (item.row + item.rowSpan) * layout.buttonHeight > 3000) {
      errors.push(`${p}grid extent exceeds 3000 dp.`);
    }
    if (items.slice(0, index).some(other => overlaps(item, other))) {
      errors.push(`${p}overlaps another key on the same layer and region.`);
    }
    if (item.kind === 'layer' && !['next', '0', '1', '2', '3', '4'].includes(item.target)) {
      errors.push(`${p}invalid layer destination.`);
    }
    if (item.backgroundOpacity !== null && (!Number.isFinite(item.backgroundOpacity) || item.backgroundOpacity < 0 || item.backgroundOpacity > 1)) {
      errors.push(`${p}opacity must be between 0 and 1.`);
    }
    if (item.outlineWidth !== null && (!Number.isFinite(item.outlineWidth) || item.outlineWidth < 0 || item.outlineWidth > 10)) {
      errors.push(`${p}outline must be between 0 and 10 dp.`);
    }
    if ([item.backgroundColor, item.textColor, item.outlineColor].some(n => n !== null && (!Number.isInteger(n) || n < -2147483648 || n > 2147483647))) {
      errors.push(`${p}colors must be signed 32-bit ARGB integers.`);
    }
  });
  const layers = populated(items);
  const start = layers[0] ?? 0;
  const reachable = (from: number): Set<number> => {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const layer = queue.shift()!;
      items.filter(i => i.layer === layer && i.visible && i.kind === 'layer').forEach((i) => {
        const next = destination(items, layer, i.target);
        if (next !== undefined && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    return seen;
  };
  if ([...reachable(start)].some(l => !reachable(l).has(start))) {
    errors.push(`${prefix}every reachable layer needs a route back to layer ${start}.`);
  }
}
export function validate(config: Configuration, layoutId?: string): string[] {
  const errors: string[] = [];
  validateIdentities(config, errors);
  validateReferences(config, errors);
  for (const layout of config.layouts.filter(l => layoutId === undefined || l.id === layoutId)) {
    validateLayout(layout, config.items.filter(i => i.layoutId === layout.id), errors);
  }
  return [...new Set(errors)];
}
export function warnings(config: Configuration, layoutId: string): string[] {
  const items = config.items.filter(i => i.layoutId === layoutId);
  return items.filter(i => !supported(i, items, config.macros)).map(i => `${label(i, config.macros)} is unsupported or has an empty layer destination; it is disabled in test mode.`);
}
export function label(item: Item, macros: Macro[]): string {
  if (item.kind === 'layer') {
    return item.target === 'next' ? 'FN' : `L${item.target}`;
  }
  if (item.kind === 'macro' || (item.kind === 'key' && item.macroId !== null)) {
    return macros.find(m => m.id === item.macroId)?.name ?? 'Missing macro';
  }
  if (item.target.startsWith('character_')) {
    const n = Number(item.target.slice(10));
    if (n === 32) {
      return 'Space';
    }
    return n >= 33 && n <= 126 ? String.fromCodePoint(n) : 'Unsupported';
  }
  const labels: Record<string, string> = { escape: 'Esc', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', enter: 'Enter', tab: 'Tab', backspace: 'Backspace', delete: 'Del', insert: 'Ins', arrow_up: 'Up', arrow_down: 'Down', arrow_left: 'Left', arrow_right: 'Right', home: 'Home', end: 'End', page_up: 'PgUp', page_down: 'PgDn', toggle_ime: 'Keyboard', toggle_compose: 'IME', text_input: 'Text input', paste: 'Paste' };
  return labels[item.target] ?? (namedKeys.includes(item.target) ? item.target.toUpperCase().replace('KEYPAD_', 'KP ') : 'Unsupported');
}
/** Full key combination for screen readers, independent of compressed key-face text. */
export function accessibleLabel(item: Item, macros: Macro[]): string {
  const name = label(item, macros);
  const macro = macros.find(m => m.id === item.macroId);
  if (macro === undefined) {
    return name;
  }
  try {
    const actions = decodeMacro(macro.document);
    const action = actions.length === 1 ? actions[0] : undefined;
    if (action?.type !== 'key') {
      return name;
    }
    const key = action.key === undefined ? action.character : label({ ...item, kind: 'key', target: action.key, macroId: null }, []);
    return `${name}, ${[...action.modifiers, key].join('+')}`;
  } catch {
    return name;
  }
}
export function validateContribution(config: Configuration): string[] {
  const errors = validate(config);
  if (config.layouts.length !== 1) {
    errors.push('Contribute exactly one layout per file.');
  }
  if (config.macros.some(m => !m.name.trim() || !config.items.some(i => i.macroId === m.id))) {
    errors.push('Every macro must have a name and be referenced by a key.');
  }
  if (config.items.some(i => !supported(i, config.items, config.macros) && i.kind !== 'layer')) {
    errors.push('Keys and macros must be supported by the current ConnectBot contract.');
  }
  return errors;
}
export function colorCss(value: number): string {
  return `#${(value >>> 0).toString(16).padStart(8, '0').slice(2)}`;
}
export function colorValue(value: string): number {
  // The bitwise OR already yields the signed 32-bit ARGB value required by Android.
  return Number.parseInt(value.slice(1), 16) | 0xFF000000;
}
function wireBoolean(value: boolean | null): number | null {
  if (value === null) {
    return null;
  }
  return value ? 1 : 0;
}
export function wireConfiguration(config: Configuration, layoutId?: string, copy = false): Record<string, unknown> {
  const layouts = config.layouts.filter(l => layoutId === undefined || l.id === layoutId);
  const items = config.items.filter(i => layouts.some(l => l.id === i.layoutId));
  const macros = config.macros.filter(m => layoutId === undefined || items.some(i => i.macroId === m.id));
  const identities = (records: { id: string }[]) => new Map(records.map(r => [r.id, copy ? newId() : r.id]));
  const layoutIds = identities(layouts);
  const itemIds = identities(items);
  const macroIds = identities(macros);
  return {
    version: 17,
    keyboard_layouts: layouts.map(l => ({ ...l, id: layoutIds.get(l.id)!, fitToWidth: l.fitToWidth ? 1 : 0 })),
    keyboard_macros: macros.map(m => ({ ...m, id: macroIds.get(m.id)! })),
    keyboard_items: items.map(i => ({ ...i, id: itemIds.get(i.id)!, layoutId: layoutIds.get(i.layoutId) ?? i.layoutId, macroId: i.macroId === null ? null : macroIds.get(i.macroId) ?? i.macroId, visible: i.visible ? 1 : 0, pinned: i.pinned ? 1 : 0, repeatOnHold: wireBoolean(i.repeatOnHold), hapticFeedback: wireBoolean(i.hapticFeedback) })),
  };
}
export function serialize(config: Configuration, layoutId?: string, copy = false): string {
  return `${JSON.stringify(wireConfiguration(config, layoutId, copy), null, 2)}\n`;
}
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'keyboard';
}
