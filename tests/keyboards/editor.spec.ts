import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { newItem, parseConfiguration, serialize, validate } from '../../src/keyboards/model';
import { createPreset } from '../../src/keyboards/presets';

async function importLayout(page: import('@playwright/test').Page, source: string) {
  await page.getByLabel('Import keyboard JSON').setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(source) });
}

test('gallery offers templates, filters, editor links, and a contribution guide', async ({ page }) => {
  await page.goto('/keyboards/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your terminal.');
  await expect(page.getByRole('heading', { name: 'Citrus', exact: true })).toBeVisible();

  await page.getByLabel('Find a layout').fill('Claw');

  await expect(page.locator('.kb-card')).toHaveCount(1);

  await page.getByRole('link', { name: 'Customize layout' }).click();

  await expect(page.getByLabel('Layout name', { exact: true })).toHaveValue('Claw');

  await page.getByRole('button', { name: 'Share your layout' }).click();

  await expect(page.getByRole('link', { name: 'Upload the JSON on GitHub' })).toHaveAttribute('href', /upload\/develop\/public\/keyboards/);
});

test('all device and orientation combinations use the selected logical viewport', async ({ page }) => {
  await page.goto('/keyboards/editor/');

  await expect(page.getByLabel('Layout name', { exact: true })).toHaveValue('Citrus');

  const preview = page.getByTestId('device-preview');
  const dimensions = { phone: [390, 844], tablet: [800, 1280], desktop: [900, 1440] };
  for (const [device, [short, long]] of Object.entries(dimensions)) {
    await page.getByLabel('Device', { exact: true }).selectOption(device);
    for (const orientation of ['portrait', 'landscape']) {
      await page.getByLabel('Orientation').selectOption(orientation);

      await expect(preview).toHaveAttribute('data-width', String(orientation === 'portrait' ? short : long));
      await expect(preview).toHaveAttribute('data-height', String(orientation === 'portrait' ? long : short));
      await expect(page.getByTestId('keyboard-grid')).toHaveCSS('width', `${orientation === 'portrait' ? short : long}px`);
      await expect(page.getByTestId('google-keyboard-preview')).toHaveCount(device === 'desktop' ? 0 : 1);

      const keyboardHeights = await preview.evaluate(element => ({
        device: element.clientHeight,
        ime: element.querySelector('.kb-gboard')?.clientHeight ?? 0,
        terminal: element.querySelector('.kb-terminal')!.clientHeight,
        controls: element.querySelector('.kb-device-keyboard')!.clientHeight,
      }));

      expect(keyboardHeights.ime).toBeGreaterThanOrEqual(device === 'desktop' ? 0 : 1);
      expect(keyboardHeights.terminal).toBeGreaterThan(0);
      expect(keyboardHeights.ime + keyboardHeights.terminal + keyboardHeights.controls).toBeLessThanOrEqual(keyboardHeights.device + 1);
    }
  }
  await page.getByLabel('Device', { exact: true }).selectOption('custom');
  await page.getByLabel('Viewport width').fill('400');
  await page.getByLabel('Viewport height').fill('600');
  await page.getByLabel('Orientation').selectOption('portrait');
  await page.getByLabel('Preview theme').selectOption('dark');

  await expect(preview).toHaveClass(/kb-theme-dark/);
  await expect(page.getByTestId('keyboard-grid')).toHaveCSS('width', '400px');
});

test('mobile Google Keyboard visibility follows the preview control and test IME action', async ({ page }) => {
  const config = createPreset('blank');
  config.layouts[0]!.buttonHeight = 200;
  config.items = [newItem(config.layouts[0]!.id, { rowSpan: 5, kind: 'app', target: 'toggle_ime' })];
  await page.goto('/keyboards/editor/');
  await importLayout(page, serialize(config));

  const ime = page.getByTestId('google-keyboard-preview');
  const grid = page.getByTestId('keyboard-grid');

  await expect(ime).toBeVisible();

  const shownHeight = await grid.evaluate(element => element.clientHeight);
  await page.getByLabel('Show Google Keyboard').uncheck();

  await expect(ime).toHaveCount(0);
  await expect.poll(async () => grid.evaluate(element => element.clientHeight)).toBeGreaterThan(shownHeight);

  await page.getByRole('button', { name: 'Test keyboard', exact: true }).click();

  await expect(ime).toBeVisible();

  await page.locator('.kb-key[data-target="toggle_ime"]').click();

  await expect(ime).toHaveCount(0);
  await expect(page.getByLabel('Show Google Keyboard')).not.toBeChecked();

  await page.locator('.kb-key[data-target="toggle_ime"]').click();

  await expect(ime).toBeVisible();
  await expect(page.getByLabel('Show Google Keyboard')).toBeChecked();

  await page.getByLabel('Preview theme').selectOption('dark');

  await expect(ime).toHaveCSS('background-color', 'rgb(32, 33, 36)');

  await page.getByRole('button', { name: 'Edit JSON', exact: true }).click();

  expect(parseConfiguration(await page.getByLabel('Keyboard JSON', { exact: true }).inputValue())).toEqual(config);
});

test('key edits, undo, JSON diagnostics, and a compatible new-copy download', async ({ page }) => {
  await page.goto('/keyboards/editor/');
  await page.locator('.kb-key[data-target="escape"]').click();

  await expect(page.getByLabel('Selected key', { exact: true })).toBeVisible();

  await page.getByLabel('Column', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();

  await expect(page.getByLabel('Column', { exact: true })).toHaveValue('0');

  await page.getByLabel('Layout name', { exact: true }).fill('My Citrus');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: false }).click();
  const download = await downloadEvent;

  expect(download.suggestedFilename()).toBe('my-citrus.json');

  const config = parseConfiguration(await readFile((await download.path()), 'utf8'));

  expect(validate(config)).toEqual([]);
  expect(config.layouts[0]!.id).not.toBe(createPreset('citrus').layouts[0]!.id);

  await page.getByRole('button', { name: 'Edit JSON', exact: true }).click();
  await page.getByLabel('Keyboard JSON', { exact: true }).fill('{broken');
  await page.getByRole('button', { name: 'Apply JSON' }).click();

  await expect(page.locator('.kb-notice')).toContainText(/JSON5|invalid|end/i);
  await expect(page.getByLabel('Keyboard JSON', { exact: true })).toHaveValue('{broken');
  await expect(page.getByLabel('Layout name', { exact: true })).toHaveValue('My Citrus');
});

test('imports preserve multi-row spans, hidden cells, pinned controls, and identity option', async ({ page }) => {
  const config = createPreset('blank');
  config.items = [newItem(config.layouts[0]!.id, { rowSpan: 2 }), newItem(config.layouts[0]!.id, { column: 1, visible: false }), newItem(config.layouts[0]!.id, { pinned: true, kind: 'app', target: 'toggle_ime' })];
  await page.goto('/keyboards/editor/');
  await importLayout(page, serialize(config));

  await expect(page.getByTestId('pinned-region')).toBeVisible();
  await expect(page.locator('.kb-key[data-row-span="2"]')).toHaveCSS('height', '60px');
  await expect(page.locator('.kb-hidden-key')).toHaveCount(1);

  await page.getByRole('button', { name: 'Test keyboard', exact: true }).click();

  await expect(page.locator('.kb-hidden-key')).toHaveCount(0);

  await page.getByText('Advanced export options', { exact: true }).click();
  await page.getByLabel('Preserve UUIDs').check();

  await expect(page.getByLabel('Preserve UUIDs')).toBeChecked();
});

test('mode cycles layers and modifiers without logging navigation', async ({ page }) => {
  await page.goto('/keyboards/editor/');
  await page.getByRole('button', { name: 'Test keyboard', exact: true }).click();
  await page.locator('.kb-key[data-target="ctrl"]').click();
  await page.locator('.kb-key[data-target="next"]').click();

  await expect(page.getByTestId('keyboard-grid')).toHaveAttribute('data-layer', '1');
  await expect(page.getByLabel('Test action log')).toContainText('ctrl: one-shot');

  await page.locator('.kb-key[data-target="f1"]').click();

  await expect(page.locator('.kb-action-log')).toContainText('key ctrl+f1');
  await expect(page.getByLabel('Test action log')).toContainText('ctrl: off');
  await expect(page.locator('.kb-action-log li')).toHaveCount(1);
});

test('visual macro editing retains invalid actions for correction and assigns a saved macro', async ({ page }) => {
  await page.goto('/keyboards/editor/');
  await page.locator('.kb-key[data-target="escape"]').click();
  await page.getByRole('button', { name: 'New macro' }).click();
  await page.getByLabel('Macro name', { exact: true }).fill('Deploy');
  await page.getByLabel('Action type', { exact: true }).selectOption('text');
  await page.getByLabel('Text', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save macro', exact: true }).click();

  await expect(page.getByLabel('Shared macro library')).toContainText('text cannot be empty');

  await page.getByLabel('Text', { exact: true }).fill('make\n');
  await page.getByRole('button', { name: 'Save macro', exact: true }).click();
  await page.getByRole('button', { name: 'Assign to selected key' }).click();

  await expect(page.getByLabel('Action kind')).toHaveValue('macro');

  await page.getByRole('button', { name: 'Test keyboard', exact: true }).click();
  await page.locator('.kb-key').filter({ hasText: 'Deploy' }).click();

  await expect(page.locator('.kb-action-log')).toContainText('text "make\\n"');
});

test('draft recovery restores local work after reload', async ({ page }) => {
  await page.goto('/keyboards/editor/');
  await page.getByLabel('Layout name', { exact: true }).fill('Remember me');

  await expect.poll(async () => page.evaluate(() => localStorage.getItem('connectbot-keyboard-draft-v1'))).toContain('Remember me');

  await page.reload();
  await page.getByRole('button', { name: 'Restore draft' }).click();

  await expect(page.getByLabel('Layout name', { exact: true })).toHaveValue('Remember me');
});

test('mobile editor fits the page and supports touch-sized controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/keyboards/editor/');

  await expect(page.getByTestId('device-preview')).toBeVisible();

  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, body: document.documentElement.scrollWidth }));

  expect(widths.body).toBeLessThanOrEqual(widths.viewport);

  await page.getByLabel('Device', { exact: true }).selectOption('tablet');
  await page.getByLabel('Orientation').selectOption('landscape');

  await expect(page.getByTestId('device-preview')).toHaveAttribute('data-width', '1280');
});

test('dragging snaps to free cells and rejects occupied cells', async ({ page }) => {
  const config = createPreset('blank');
  const id = config.layouts[0]!.id;
  config.items = [newItem(id), newItem(id, { column: 2 })];
  await page.goto('/keyboards/editor/');
  await importLayout(page, serialize(config));
  const first = page.locator(`.kb-key[data-key-id="${config.items[0]!.id}"]`);
  await first.scrollIntoViewIfNeeded();
  const bounds = await first.boundingBox();
  const scale = bounds!.width / 45;
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 45 * scale, bounds!.y + bounds!.height / 2, { steps: 6 });
  await page.mouse.up();
  await first.click();

  await expect(page.getByLabel('Column', { exact: true })).toHaveValue('1');

  const updated = await first.boundingBox();
  await page.mouse.move(updated!.x + updated!.width / 2, updated!.y + updated!.height / 2);
  await page.mouse.down();
  await page.mouse.move(updated!.x + updated!.width / 2 + 45 * scale, updated!.y + updated!.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(page.locator('.kb-notice')).toContainText('occupied');
  await expect(page.getByLabel('Column', { exact: true })).toHaveValue('1');
});

test('unassigned macros survive draft recovery and unsupported documents are disabled', async ({ page }) => {
  await page.goto('/keyboards/editor/');
  await page.getByRole('button', { name: 'New macro' }).click();
  await page.getByLabel('Macro name', { exact: true }).fill('Unassigned');
  await page.getByRole('button', { name: 'Save macro', exact: true }).click();

  await expect.poll(async () => page.evaluate(() => localStorage.getItem('connectbot-keyboard-draft-v1'))).toContain('Unassigned');

  await page.reload();
  await page.getByRole('button', { name: 'Restore draft' }).click();

  await expect(page.getByRole('button', { name: 'Unassigned' })).toBeVisible();

  const config = createPreset('claw');
  config.macros[0]!.document = '{"version":999,"actions":[]}';
  await importLayout(page, serialize(config));
  await page.getByRole('button', { name: 'Test keyboard', exact: true }).click();

  await expect(page.locator('.kb-key[data-target="character_99"]')).toBeDisabled();

  await page.getByRole('button', { name: 'Share your layout' }).click();

  await expect(page.getByLabel('Share your layout')).toContainText('must be supported');

  const unknown = createPreset('blank');
  unknown.items = [newItem(unknown.layouts[0]!.id, { kind: 'toString' })];
  await importLayout(page, serialize(unknown));
  await page.getByRole('button', { name: 'Edit keys', exact: true }).click();
  await page.locator('.kb-key[data-target="escape"]').click();

  await expect(page.getByLabel('Action kind')).toHaveValue('toString');
});

test('held arrow keys repeat and stop immediately on release', async ({ page }) => {
  await page.goto('/keyboards/editor/');
  await page.getByRole('button', { name: 'Test keyboard', exact: true }).click();
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  const arrow = page.locator('.kb-key[data-target="arrow_up"]');
  await arrow.scrollIntoViewIfNeeded();
  const bounds = await arrow.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(100);

  await expect(page.locator('.kb-action-log li')).toHaveCount(1);

  await page.clock.runFor(400);

  await expect(page.locator('.kb-action-log li')).toHaveCount(2);

  await page.mouse.up();
  await page.clock.runFor(1000);

  await expect(page.locator('.kb-action-log li')).toHaveCount(2);
});
