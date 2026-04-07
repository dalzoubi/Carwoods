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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: portalDevAuth
      ? 'VITE_PORTAL_DEV_AUTH=true npm run build && npx serve -s build -l 3000'
      : 'npm run build && npx serve -s build -l 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
