import { defineConfig, devices } from '@playwright/test';

const portalDevAuth = process.env.PORTAL_E2E === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: {
      // Allow tiny anti-aliasing / font-rendering differences; fail on real UI changes.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/visual/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual-chromium',
      testMatch: '**/visual/**/*.visual.spec.mjs',
      use: {
        ...devices['Desktop Chrome'],
        // Force a predictable timezone, locale, and color scheme so snapshots
        // are stable across dev machines and CI runners.
        locale: 'en-US',
        timezoneId: 'America/Chicago',
        colorScheme: 'light',
      },
    },
  ],
  webServer: {
    command: portalDevAuth
      ? 'VITE_PORTAL_DEV_AUTH=true npm run build && npx serve -s build -l 3000'
      : 'npm run build && npx serve -s build -l 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
