import type { Page } from '@playwright/test';
import type { GuideVariant } from '../../src/guides/types';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import guides from '../../src/guides/en.json' with { type: 'json' };

const guide = guides[0]!;

function makeVariant(language: string, apiLevel: number, theme: 'light' | 'dark'): GuideVariant {
  return {
    id: `${guide.id}/${language}/${apiLevel}/${theme}`,
    guide: guide.id,
    language,
    apiLevel,
    theme,
    appVersion: 'browser-test',
    width: 1080,
    height: 1920,
    duration: 6,
    poster: '/logo.png',
    webm: `/guide-test/video.webm?language=${language}&api=${apiLevel}&theme=${theme}`,
    mp4: `/guide-test/video.mp4?language=${language}&api=${apiLevel}&theme=${theme}`,
    chapters: '/guide-test/chapters.vtt',
    captions: '/guide-test/chapters.vtt',
    narrated: true,
    transcript: guide.steps,
    steps: guide.steps.map((step, index) => ({
      id: step.id,
      startSeconds: index,
      endSeconds: index + 1,
      image: '/logo.png',
      hotspot: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 },
    })),
  };
}

async function fixtures(page: Page) {
  await page.route('**/guides/index.json', async route => route.fulfill({ json: {
    schemaVersion: 1,
    variants: ['en', 'es', 'ar'].flatMap(language => [29, 36].flatMap(api => (['light', 'dark'] as const).map(theme => makeVariant(language, api, theme)))),
  } }));
  await page.route('**/guide-test/video.*', async (route) => {
    const extension = new URL(route.request().url()).pathname.endsWith('.webm') ? 'webm' : 'mp4';
    const body = await readFile(`local/browser-fixtures/video.${extension}`);
    await route.fulfill({ body, contentType: extension === 'webm' ? 'video/webm' : 'video/mp4', headers: { 'Accept-Ranges': 'bytes' } });
  });
  await page.route('**/guide-test/chapters.vtt', async route => route.fulfill({ body: 'WEBVTT\n\n00:00:00.000 --> 00:00:06.000\nTest narration\n', contentType: 'text/vtt' }));
}

test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test('chapter links seek while remaining paused, including direct links', async ({ page }) => {
  await page.goto('/guides/special-keys/#watch-open-settings');

  await expect(page.getByRole('link', { name: 'Watch this step', exact: true })).toHaveCount(guide.steps.length);

  const video = page.locator('video');

  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(1, 1);
  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

  await page.getByRole('button', { name: /Find the Keyboard section/ }).click();

  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(2, 1);
  await expect(page.getByRole('button', { name: /Find the Keyboard section/ })).toHaveAttribute('aria-current', 'step');
});

test('site preferences preserve the step; tours support keyboard navigation', async ({ page }) => {
  await page.goto('/guides/special-keys/');
  await page.getByRole('button', { name: /Open Settings/ }).click();

  await expect(page.locator('.guide-demo select')).toHaveCount(0);

  await page.evaluate(() => {
    document.documentElement.lang = 'ar-EG';
  });
  await page.locator('[title="Change theme"]:visible').click();
  await page.getByRole('option', { name: 'Light', exact: true }).click();

  await expect.poll(async () => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentSrc))
    .toContain('language=ar&api=36&theme=light');

  await expect(page.getByRole('button', { name: /Open Settings/ })).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: 'Step through', exact: true }).click();
  const hotspot = page.getByRole('button', { name: 'Open Settings — next step' });
  await hotspot.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('list', { name: 'Video chapters' }).getByRole('button', { name: /Find the Keyboard section/ })).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
});

test('reduced motion prevents autoplay and listening enables audio once', async ({ page }) => {
  await page.goto('/guides/special-keys/');
  const video = page.locator('video');

  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused && v.muted)).toBe(true);

  await page.getByRole('button', { name: 'Listen', exact: true }).click();

  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted || v.loop)).toBe(false);
  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
});

test('missing recordings leave the written guide available', async ({ page }) => {
  await page.route('**/guides/index.json', async route => route.fulfill({ json: { schemaVersion: 1, variants: [] } }));
  await page.goto('/guides/special-keys/');

  await expect(page.getByRole('heading', { name: 'Step by step' })).toBeVisible();
  await expect(page.locator('.guide-demo, .guide-notice')).toHaveCount(0);
  await expect(page.getByText('The written guide is ready.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Watch this step', exact: true })).toHaveCount(0);
});

test('unavailable site theme hides the walkthrough and watch links', async ({ page }) => {
  await page.route('**/guides/index.json', async route => route.fulfill({ json: {
    schemaVersion: 1,
    variants: [makeVariant('en', 36, 'dark')],
  } }));
  await page.goto('/guides/special-keys/');
  await page.locator('[title="Change theme"]:visible').click();
  await page.getByRole('option', { name: 'Light', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Step by step' })).toBeVisible();
  await expect(page.locator('.guide-demo, .guide-notice')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Watch this step', exact: true })).toHaveCount(0);
});
