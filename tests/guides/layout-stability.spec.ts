import { expect, test } from '@playwright/test';

for (const width of [390, 1200]) {
  test.describe(`cold loads at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('late fonts do not move the download badges', async ({ page }) => {
      let releaseFonts!: () => void;
      const fontsReady = new Promise<void>((resolve) => {
        releaseFonts = resolve;
      });
      await page.route('**/*.woff2', async (route) => {
        await fontsReady;
        await route.continue();
      });
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const badges = page.locator('.download-badges');

        await expect(badges).toBeVisible();

        // Let the browser commit to the fallback after the optional font block period.
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await page.waitForTimeout(200);
        const before = await badges.boundingBox();
        releaseFonts();
        await page.evaluate(async () => document.fonts.ready.then(() => undefined));
        await page.evaluate(async () => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));

        await expect.poll(async () => (await badges.boundingBox())?.y).toBe(before?.y);
        await expect(page.locator('.f-droid-badge')).toHaveAttribute('loading', 'eager');
        await expect(page.locator('.f-droid-badge')).toHaveAttribute('fetchpriority', 'high');
      } finally {
        releaseFonts();
      }
    });

    test('the walkthrough reserves its layout before the recording index arrives', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      let releaseIndex!: () => void;
      const indexReady = new Promise<void>((resolve) => {
        releaseIndex = resolve;
      });
      await page.route('**/guides/index.json', async (route) => {
        await indexReady;
        await route.continue();
      });
      try {
        await page.goto('/guides/add-host/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(async () => document.fonts.ready.then(() => undefined));

        await expect(page.locator('.guide-demo')).toBeVisible();

        const instructions = page.locator('.guide-instructions');

        await expect(instructions).toBeVisible();

        const before = await instructions.boundingBox();
        const response = page.waitForResponse('**/guides/index.json');
        releaseIndex();
        await response;
        await page.evaluate(async () => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));

        await expect.poll(async () => (await instructions.boundingBox())?.y).toBe(before?.y);
        expect(errors).toEqual([]);
      } finally {
        releaseIndex();
      }
    });
  });
}
