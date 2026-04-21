import { defineConfig, devices } from '@playwright/test';

/**
 * Portal/admin visual specs need `vite build` with `VITE_PORTAL_DEV_AUTH=true` so routes render
 * the authenticated shell instead of the sign-in landing. CI and `npm run test:visual` set
 * `PORTAL_E2E=true`; we also enable that build when Playwright is clearly running visual specs only
 * (many users invoke `playwright test --project=visual-chromium` without the env).
 *
 * If you run **both** `chromium` and `visual-chromium` in one command without `PORTAL_E2E`, the
 * webServer cannot satisfy both builds — set `PORTAL_E2E=true` (dev-auth build) or run projects separately.
 */
function usePortalDevAuthWebBuild() {
  if (process.env.PORTAL_E2E === 'true') return true;

  const argv = process.argv;

  const projectNames = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project' || arg === '-p') {
      if (argv[i + 1]) projectNames.push(argv[i + 1]);
    } else if (arg.startsWith('--project=')) {
      projectNames.push(arg.slice('--project='.length));
    }
  }

  const normalizedPathArgs = argv.filter((a) => typeof a === 'string' && !a.startsWith('-'));
  const pathTouchesVisualSpecs = normalizedPathArgs.some((a) =>
    /(^|[\\/])e2e[\\/]visual[\\/]/i.test(a.replace(/\\/g, '/')),
  );
  if (pathTouchesVisualSpecs) return true;

  if (projectNames.length === 0) return false;

  const hasChromiumProject = projectNames.some((p) => p === 'chromium');
  const hasVisualProject = projectNames.some((p) => p.includes('visual'));

  if (hasVisualProject && !hasChromiumProject) return true;

  if (projectNames.length === 1 && hasVisualProject) return true;

  return false;
}

const portalDevAuth = usePortalDevAuthWebBuild();

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
      ? 'npx cross-env VITE_PORTAL_DEV_AUTH=true VITE_API_BASE_URL=http://localhost:3000 npm run build && npx serve -s build -l 3000'
      : 'npm run build && npx serve -s build -l 3000',
    url: 'http://localhost:3000',
    // Default Playwright timeout is 60s — insufficient for `npm run build` + `serve` on slower machines.
    timeout: Number.parseInt(process.env.PW_WEB_SERVER_TIMEOUT_MS ?? '', 10) || 600_000,
    // Default: never reuse → we always serve this repo's production `build/` (otherwise a
    // stray process on :3000 yields blank screenshots / wrong UI). Opt in with PW_REUSE_SERVER=1.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
  },
});
