import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geometry } from '../../src/keyboards/geometry';
import { colorCss, colorValue, decodeMacro, destination, encodeMacro, newId, newItem, parseConfiguration, populated, serialize, supported, validate, wireConfiguration } from '../../src/keyboards/model';
import { createPreset, templates } from '../../src/keyboards/presets';

for (const template of templates) {
  void test(`${template.name} matches the app contract and round trips`, () => {
    const config = createPreset(template.key);
    assert.deepEqual(validate(config), []);
    assert.deepEqual(parseConfiguration(serialize(config)), config);
    assert.ok(config.items.every(i => supported(i, config.items, config.macros)));
    if (template.key !== 'classic') {
      assert.deepEqual(populated(config.items), [0, 1]);
      assert.equal(config.items.filter(i => i.layer === 1 && /^f\d+$/.test(i.target)).length, 12);
      assert.equal(destination(config.items, 0, 'next'), 1);
      assert.equal(destination(config.items, 1, 'next'), 0);
    }
  });
}

void test('reference preset order, heights, spans, and explicit shortcut actions', () => {
  const citrus = createPreset('citrus');
  assert.equal(citrus.layouts[0]!.buttonHeight, 36);
  assert.deepEqual(citrus.items.filter(i => i.layer === 0 && i.row === 0).map(i => i.target), ['escape', 'character_47', 'character_124', 'character_45', 'home', 'arrow_up', 'end', 'page_up', 'next']);
  assert.equal(citrus.items.find(i => i.layer === 0 && i.target === 'ctrl')!.columnSpan, 2);
  const claw = createPreset('claw');
  assert.equal(claw.layouts[0]!.buttonHeight, 44);
  assert.deepEqual(decodeMacro(claw.macros.find(m => m.name === 'Mode')!.document), [{ type: 'key', key: 'tab', modifiers: ['shift'] }]);
});

void test('exports use camelCase, integer boolean values, and opaque macro strings', () => {
  const config = createPreset('claw');
  config.items[0]!.repeatOnHold = false;
  config.items[0]!.hapticFeedback = true;
  const root = JSON.parse(serialize(config)) as { version: number; keyboard_layouts: Record<string, unknown>[]; keyboard_items: Record<string, unknown>[]; keyboard_macros: Record<string, unknown>[] };
  assert.equal(root.version, 17);
  assert.equal(root.keyboard_layouts[0]!.fitToWidth, 1);
  assert.equal(root.keyboard_layouts[0]!.buttonHeight, 44);
  assert.equal(root.keyboard_items[0]!.visible, 1);
  assert.equal(root.keyboard_items[0]!.pinned, 0);
  assert.equal(root.keyboard_items[0]!.repeatOnHold, 0);
  assert.equal(root.keyboard_items[0]!.hapticFeedback, 1);
  assert.equal(typeof root.keyboard_macros[0]!.document, 'string');
  assert.ok(!('keyboard_settings' in root));
});

void test('new copies remap every identity and retain shared macro references', () => {
  const config = createPreset('claw');
  const shortcut = config.items.find(i => i.macroId !== null)!;
  const shared = config.items.find(i => i.row === 1 && i.layer === 0)!;
  shared.macroId = shortcut.macroId;
  const copy = parseConfiguration(serialize(config, config.layouts[0]!.id, true));
  const previousIds = new Set([...config.layouts, ...config.items, ...config.macros].map(r => r.id));
  assert.ok([...copy.layouts, ...copy.items, ...copy.macros].every(r => !previousIds.has(r.id)));
  assert.equal(copy.items.find(i => i.id === shared.id), undefined);
  const copiedShortcut = copy.items[config.items.indexOf(shortcut)]!;
  const copiedShared = copy.items[config.items.indexOf(shared)]!;
  assert.equal(copiedShortcut.macroId, copiedShared.macroId);
  assert.ok(copy.macros.some(m => m.id === copiedShortcut.macroId));
  assert.ok(copy.items.every(i => i.layoutId === copy.layouts[0]!.id));
  assert.deepEqual(validate(copy), []);
});

void test('JSON5 imports normalize legacy defaults and strip host data from output', () => {
  const id = newId();
  const config = parseConfiguration(`/* old config */ {keyboard_layouts:[{id:'${id}',name:'Legacy',}],keyboard_items:[],hosts:[{nickname:'private'}],}`);
  assert.equal(config.layouts[0]!.buttonWidth, 45);
  assert.equal(config.layouts[0]!.buttonHeight, 30);
  assert.equal(config.layouts[0]!.fitToWidth, false);
  assert.ok(!serialize(config).includes('private'));
  assert.throws(() => parseConfiguration('{ keyboard_layouts: true }'), /array/);
  assert.throws(() => parseConfiguration('[]'), /object/);
});

void test('selected-layout exports include only the referenced dependency closure', () => {
  const config = createPreset('claw');
  const other = createPreset('citrus');
  config.layouts.push(...other.layouts);
  config.items.push(...other.items);
  config.macros.push({ id: newId(), name: 'Unused', document: encodeMacro([{ type: 'text', text: 'unused' }]) });
  const output = parseConfiguration(serialize(config, other.layouts[0]!.id));
  assert.equal(output.layouts.length, 1);
  assert.equal(output.macros.length, 0);
  assert.ok(output.items.every(i => i.layoutId === other.layouts[0]!.id));
});

void test('legacy multi-row keys, appearance, nullable behavior, and extra row fields survive', () => {
  const config = createPreset('blank');
  config.items.push(newItem(config.layouts[0]!.id, { rowSpan: 3, columnSpan: 2, backgroundColor: -65536, textColor: -1, outlineWidth: 0, backgroundOpacity: 0.4, repeatOnHold: null, hapticFeedback: false }));
  const raw = wireConfiguration(config) as { keyboard_items: Record<string, unknown>[] };
  raw.keyboard_items[0]!.futureAppearance = 'preserve';
  const result = parseConfiguration(JSON.stringify(raw));
  assert.equal(result.items[0]!.rowSpan, 3);
  assert.equal((wireConfiguration(result) as typeof raw).keyboard_items[0]!.futureAppearance, 'preserve');
  assert.deepEqual(validate(result), []);
  assert.equal(colorValue('#ff0000'), -65536);
  assert.equal(colorValue('#ffffff'), -1);
  assert.equal(colorValue('#000000'), -16777216);
  assert.equal(colorCss(-65536), '#ff0000');
});

void test('validation rejects overlap including hidden keys, but allows separate layers and docks', () => {
  const config = createPreset('blank');
  const first = newItem(config.layouts[0]!.id);
  config.items = [first, newItem(first.layoutId, { visible: false })];
  assert.match(validate(config).join(), /overlap/);
  config.items[1]!.layer = 1;
  assert.deepEqual(validate(config), []);
  config.items[1]!.layer = 0;
  config.items[1]!.pinned = true;
  assert.deepEqual(validate(config), []);
});

void test('validation enforces geometry, color, dimension, and identity limits', () => {
  const config = createPreset('blank');
  config.items = [newItem(config.layouts[0]!.id, { column: 1000, rowSpan: 0, layer: 5, backgroundOpacity: 2, outlineWidth: 11, textColor: 0xFFFFFFFF })];
  config.layouts[0]!.buttonWidth = 0;
  const errors = validate(config).join();
  assert.match(errors, /dimensions/);
  assert.match(errors, /invalid position/);
  assert.match(errors, /opacity/);
  assert.match(errors, /outline/);
  assert.match(errors, /32-bit/);
  config.layouts[0]!.id = 'INVALID';
  assert.match(validate(config).join(), /UUID/);
});

void test('reachable layers must have a route home and FN ignores empty or switch-only layers', () => {
  const config = createPreset('blank');
  const id = config.layouts[0]!.id;
  config.items = [newItem(id), newItem(id, { kind: 'layer', target: '1', column: 1 }), newItem(id, { layer: 1 }), newItem(id, { kind: 'layer', target: 'next', layer: 2 })];
  assert.match(validate(config).join(), /route back/);
  assert.deepEqual(populated(config.items), [0, 1]);
  assert.equal(destination(config.items, 1, 'next'), 0);
  assert.equal(destination(config.items, 0, '2'), undefined);
  config.items.push(newItem(id, { kind: 'layer', target: 'next', layer: 1, column: 1 }));
  assert.deepEqual(validate(config), []);
});

void test('macro validation covers Unicode scalars, exact fields, versions, and resource limits', () => {
  assert.deepEqual(decodeMacro(encodeMacro([{ type: 'key', character: '😀', modifiers: ['ctrl'] }, { type: 'bytes', hex: '00FF' }, { type: 'text', text: 'a\nb' }])), [{ type: 'key', character: '😀', modifiers: ['ctrl'] }, { type: 'bytes', hex: '00ff' }, { type: 'text', text: 'a\nb' }]);
  for (const actions of [[{ type: 'text', text: '' }], [{ type: 'key', character: '\uD800', modifiers: [] }], [{ type: 'key', key: 'enter', character: 'a', modifiers: [] }], [{ type: 'bytes', hex: '0ff' }], [{ type: 'key', key: 'enter', modifiers: ['alt', 'alt'] }], [{ type: 'text', text: 'ok', future: true }]]) {
    assert.throws(() => decodeMacro(JSON.stringify({ version: 1, actions })));
  }
  assert.throws(() => decodeMacro('{version:2,actions:[]}'), /version/);
  for (const type of ['toString', '__proto__', 'constructor']) {
    assert.throws(() => decodeMacro(JSON.stringify({ version: 1, actions: [{ type }] })), /Action 1: unsupported action type/);
  }
  assert.throws(() => decodeMacro(JSON.stringify({ version: 1, actions: Array.from({ length: 257 }, () => ({ type: 'text', text: 'a' })) })), /256/);
  assert.throws(() => decodeMacro(' '.repeat(65537)), /65,536/);
});

void test('unsupported macro documents remain opaque and disable their keys', () => {
  const config = createPreset('claw');
  const item = config.items.find(i => i.macroId !== null)!;
  const macro = config.macros.find(m => m.id === item.macroId)!;
  macro.document = '{"version":9,"actions":[],"future":true}';
  const result = parseConfiguration(serialize(config));
  assert.equal(result.macros.find(m => m.id === macro.id)!.document, macro.document);
  assert.equal(supported(item, config.items, config.macros), false);
});

void test('fitted geometry uses all layers and hidden keys and preserves pixel boundaries', () => {
  const config = createPreset('citrus');
  const layout = config.layouts[0]!;
  const region = geometry(layout, config.items, 400, 500)[0]!;
  assert.equal(region.width, 400);
  assert.equal(region.columns, 9);
  assert.equal(region.height, 72);
  const ctrl = region.rects.find(r => r.item.layer === 0 && r.item.target === 'ctrl')!;
  assert.equal(ctrl.x, 44);
  assert.equal(ctrl.width, 89);
  config.items.push(newItem(layout.id, { layer: 4, row: 5, column: 10, visible: false }));
  const extended = geometry(layout, config.items, 400, 120)[0]!;
  assert.equal(extended.columns, 11);
  assert.equal(extended.cellHeight, 20);
  assert.equal(extended.height, 120);
});

void test('fixed dock reserves trailing width and fitted mode appends pinned coordinates', () => {
  const config = createPreset('classic');
  const layout = config.layouts[0]!;
  const regions = geometry(layout, config.items, 390, 100);
  assert.equal(regions.length, 2);
  assert.equal(regions[1]!.viewportWidth, 90);
  assert.equal(regions[0]!.viewportWidth, 297);
  assert.equal(regions[1]!.x, 300);
  assert.ok(regions[0]!.width > regions[0]!.viewportWidth);
  layout.fitToWidth = true;
  const fitted = geometry(layout, config.items, 390, 100);
  assert.equal(fitted.length, 1);
  assert.equal(fitted[0]!.columns, 26);
  assert.deepEqual(config.items.filter(i => i.pinned).map(i => i.column), [0, 1]);
});

void test('gallery discovers a standalone contribution and rejects unrelated tables', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readGallery } = await import('../../src/keyboards/gallery');
  const directory = await mkdtemp(join(tmpdir(), 'connectbot-gallery-'));
  try {
    await writeFile(join(directory, 'my-layout.json'), serialize(createPreset('claw')));
    assert.equal((await readGallery(directory)).filter(e => !e.template)[0]!.name, 'Claw');
    const invalid = wireConfiguration(createPreset('claw'));
    invalid.keyboard_layouts = [{ ...createPreset('claw').layouts[0]!, fitToWidth: true }];
    await writeFile(join(directory, 'my-layout.json'), JSON.stringify(invalid));
    await assert.rejects(readGallery(directory), /integer 0\/1/);
    await writeFile(join(directory, 'my-layout.json'), serialize(createPreset('claw')));
    await writeFile(join(directory, 'private.json'), JSON.stringify({ ...wireConfiguration(createPreset('citrus')), hosts: [] }));
    await assert.rejects(readGallery(directory), /private.json.*unrelated configuration/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

void test('gallery rejects colliding identities and malformed portable macros', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readGallery } = await import('../../src/keyboards/gallery');
  const directory = await mkdtemp(join(tmpdir(), 'connectbot-gallery-'));
  try {
    const source = serialize(createPreset('claw'));
    await writeFile(join(directory, 'first.json'), source);
    await writeFile(join(directory, 'second.json'), source);
    await assert.rejects(readGallery(directory), /already contributed/);
    await rm(join(directory, 'second.json'));
    const config = createPreset('claw');
    config.macros[0]!.document = '{version:999,actions:[]}';
    await writeFile(join(directory, 'first.json'), serialize(config));
    await assert.rejects(readGallery(directory), /must be supported/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

void test('draft serialization retains unassigned library macros but layout downloads omit them', () => {
  const config = createPreset('blank');
  config.macros.push({ id: newId(), name: 'Not assigned yet', document: encodeMacro([{ type: 'text', text: 'work in progress' }]) });
  assert.equal(parseConfiguration(serialize(config)).macros.length, 1);
  assert.equal(parseConfiguration(serialize(config, config.layouts[0]!.id)).macros.length, 0);
});

void test('UUIDs are unique per table and copies remap cross-table collisions independently', () => {
  const config = createPreset('blank');
  const id = config.layouts[0]!.id;
  config.macros.push({ id, name: 'Same UUID in a separate table', document: encodeMacro([{ type: 'text', text: 'a' }]) });
  config.items.push(newItem(id, { id, kind: 'macro', macroId: id }));
  assert.deepEqual(validate(config), []);
  const copy = parseConfiguration(serialize(config, id, true));
  assert.equal(new Set([copy.layouts[0]!.id, copy.items[0]!.id, copy.macros[0]!.id]).size, 3);
  assert.equal(copy.items[0]!.macroId, copy.macros[0]!.id);
  assert.equal(copy.items[0]!.layoutId, copy.layouts[0]!.id);
});
