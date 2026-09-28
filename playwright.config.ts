import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/guides',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:3012', contextOptions: { reducedMotion: 'reduce' } },
  webServer: {
    command: 'python3 -m http.server 3012 --bind 127.0.0.1 --directory out',
    url: 'http://127.0.0.1:3012/guides/',
    reuseExistingServer: process.env.CI !== 'true',
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
