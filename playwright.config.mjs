import { defineConfig, devices } from '@playwright/test';

const portalDevAuth = process.env.PORTAL_E2E === 'true';

export default defineConfig({
  testDir: './e2e',
  // One PNG per viewport per project (no `-linux`/`-win32` suffix) so CI and local runs
  // share baselines; update with `npm run test:visual:update`.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
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
      // snap() waits up to 60s for first paint; keep test timeout above that.
      timeout: 120000,
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
    // Windows CMD does not support `VAR=value cmd`; use cross-env like npm scripts.
    command: portalDevAuth
      ? 'npx cross-env VITE_PORTAL_DEV_AUTH=true npm run build && npx serve -s build -l 3000'
      : 'npm run build && npx serve -s build -l 3000',
    url: 'http://localhost:3000',
    // Default: never reuse → we always serve this repo's production `build/` (otherwise a
    // stray process on :3000 yields blank screenshots / wrong UI). Opt in with PW_REUSE_SERVER=1.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
  },
});
