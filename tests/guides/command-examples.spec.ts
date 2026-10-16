import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/guides/verify-installation/');
});

test('release input updates every command and preserves shell formatting', async ({ page }) => {
  const templates = page.locator('.command-template');
  const release = page.getByRole('textbox', { name: 'Release tag' });

  await expect(templates).toHaveCount(2);
  await expect(templates.getByRole('button', { name: 'Copy code' })).toHaveCount(0);

  await release.fill('v1.11.1');

  await expect(templates.first().locator('code')).toContainText('APK=\'ConnectBot-v1.11.1-oss.apk\'');
  await expect(templates.last().locator('code')).toContainText('ARTIFACT=\'ConnectBot-v1.11.1-google.aab\'');
  await expect(templates.last().locator('code')).toContainText('EVIDENCE=\'ConnectBot-v1.11.1-signing-evidence.zip\'');
  await expect(templates.first().locator('code')).toContainText('check-transparency \\\n  --mode=apk');
  await expect(templates.first().locator('code')).toContainText('zip downloaded-apks.zip "$APK"');

  await release.fill('git-v1.11.1-3-g670d06ef');

  await expect(templates.first().locator('code')).toContainText('ConnectBot-git-v1.11.1-3-g670d06ef-oss.apk');
  await expect(templates.last().locator('code')).toContainText('ConnectBot-git-v1.11.1-3-g670d06ef-google.aab');
  await expect(templates.last().locator('code')).toContainText('ConnectBot-git-v1.11.1-3-g670d06ef-signing-evidence.zip');
  await expect(templates.getByRole('button', { name: 'Copy code' })).toHaveCount(2);
});

test('invalid or missing release values cannot be copied into commands', async ({ page }) => {
  const templates = page.locator('.command-template');
  const release = page.getByRole('textbox', { name: 'Release tag' });

  await release.fill('v1.11.1\'; echo unsafe; \'');

  await expect(release).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('status')).toContainText('Use letters, numbers');
  await expect(templates.first().locator('code')).toContainText('ConnectBot-{{release}}-oss.apk');
  await expect(templates.getByRole('button', { name: 'Copy code' })).toHaveCount(0);

  await release.fill('v1.11.1');

  await expect(release).toHaveAttribute('aria-invalid', 'false');
  await expect(templates.getByRole('button', { name: 'Copy code' })).toHaveCount(2);

  await release.clear();

  await expect(templates.last().locator('code')).toContainText('ConnectBot-{{release}}-google.aab');
  await expect(templates.getByRole('button', { name: 'Copy code' })).toHaveCount(0);
});

test('copy button copies the current substituted command', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedCommand = text;
        },
      },
    });
  });
  await page.getByRole('textbox', { name: 'Release tag' }).fill('v1.11.1');
  const template = page.locator('.command-template').last();
  const expected = await template.locator('code').textContent();

  await template.getByRole('button', { name: 'Copy code' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-copied-command', expected!);
});
