/**
 * Shared fixtures for Playwright visual regression tests.
 *
 * Goals
 *  - Deterministic rendering: pin time, disable animations, mock APIs.
 *  - Reusable viewports: mobile / tablet / desktop sweeps in every spec.
 *  - A single helper `snap(page, name)` that waits for the page to settle
 *    before capturing, so individual specs stay readable.
 */
import { test as base, expect } from '@playwright/test';

/** Viewports captured by every visual spec. */
export const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

/** Fixed ISO instant baked into the page before any script runs. */
const FROZEN_NOW_ISO = '2026-01-15T12:00:00.000Z';

/**
 * Return a canned API response for a URL. Kept inline (rather than JSON files)
 * so the whole contract is visible in one place. Extend as new pages need data.
 */
function mockApiResponse(url) {
  if (url.endsWith('/api/portal/me') || url.includes('/api/portal/me?')) {
    return {
      role: 'landlord',
      user: {
        id: 'dev-user',
        first_name: 'Dev',
        last_name: 'Landlord',
        role: 'landlord',
        status: 'ACTIVE',
        email: 'dev@carwoods.com',
        sms_notifications_allowed: false,
        portal_tour_completed: true,
      },
    };
  }
  if (url.includes('/api/portal/admin/landlords')) {
    return { landlords: [] };
  }
  if (url.includes('/api/portal/admin/tiers')) {
    return { tiers: [] };
  }
  if (url.includes('/api/portal/admin/contact-requests')) {
    return { requests: [], total: 0 };
  }
  if (url.includes('/api/portal/admin/users')) {
    return { users: [] };
  }
  if (url.includes('/api/portal/requests')) {
    return { requests: [], total: 0 };
  }
  if (url.includes('/api/portal/payments')) {
    return { payments: [], total: 0 };
  }
  if (url.includes('/api/portal/lease')) {
    return { lease: null };
  }
  if (url.includes('/api/portal/tenants')) {
    return { tenants: [], total: 0 };
  }
  if (url.includes('/api/portal/properties')) {
    return { properties: [], total: 0 };
  }
  if (url.includes('/api/portal/notifications')) {
    return { notifications: [], unread_count: 0 };
  }
  if (url.includes('/api/portal/documents')) {
    return { documents: [] };
  }
  // Default: empty object — enough to prevent runtime errors for unlisted endpoints.
  return {};
}

/**
 * Block outbound Firebase / analytics calls without breaking reCAPTCHA v3 or fonts.
 * A broad `(gstatic|recaptcha)` pattern caused empty 204 responses for
 * `www.gstatic.com/recaptcha/**` and `google.com/recaptcha/**`, so the app never
 * hydrated past `GoogleReCaptchaProvider` and `snap()` timed out.
 */
function shouldBlockOutboundThirdParty(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname;

    if (host.endsWith('firebaseio.com')) return true;

    if (/vitals\.vercel-insights\.com$/i.test(host)) return true;
    if (host.includes('vercel-analytics')) return true;

    // Firebase JS SDK bundles only — allow `www.gstatic.com/recaptcha/**`, fonts, etc.
    if (host === 'www.gstatic.com' && path.includes('/firebasejs/')) return true;

    const firebaseGoogleApisHosts = new Set([
      'securetoken.googleapis.com',
      'identitytoolkit.googleapis.com',
      'firestore.googleapis.com',
      'firebaseinstallations.googleapis.com',
      'firebase.googleapis.com',
      'firebasestorage.googleapis.com',
    ]);
    if (firebaseGoogleApisHosts.has(host)) return true;

    return false;
  } catch {
    return false;
  }
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Extended Playwright test with visual-regression-friendly defaults installed
 * on every `page` automatically.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Pin Date.now / new Date() so any "today" label renders identically on every run.
    await page.addInitScript((frozenIso) => {
      const frozen = new Date(frozenIso).getTime();
      const RealDate = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            super(frozen);
            return;
          }
          super(...args);
        }
        static now() {
          return frozen;
        }
      };
      Date.UTC = RealDate.UTC;
      Date.parse = RealDate.parse;
    }, FROZEN_NOW_ISO);

    // Local API mocks + targeted third-party blocks (single handler so ordering is obvious).
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (isLocalhostUrl(url) && url.includes('/api/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockApiResponse(url)),
        });
        return;
      }
      if (!isLocalhostUrl(url) && shouldBlockOutboundThirdParty(url)) {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.continue();
    });

    // Kill animations and transitions across the whole app.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await use(page);
  },
});

export { expect };

/**
 * Wait for the page to look settled, then take a screenshot.
 * - Waits for `load`, then network idle (best-effort).
 * - Waits until **real UI exists** — `networkidle` alone often fires before the
 *   production bundle paints, giving solid-white PNGs.
 * - Marketing + authenticated portal use `#main-content`. Portal login / loading
 *   screens omit it; we fall back to substantial `#root` markup.
 * - Waits for fonts, then one paint frame pair for layout stability.
 */
export async function snap(page, name) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(
    () => {
      const main = document.getElementById('main-content');
      if (main && main.getClientRects().length > 0) return true;
      const root = document.getElementById('root');
      if (!root) return false;
      const stripped = root.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
      return stripped.trim().length > 400;
    },
    { timeout: 60000 },
  );
  await page.evaluate(() => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [page.locator('[data-visual-mask]')],
  });
}

/**
 * Run `fn(page, viewport)` once for each viewport in VIEWPORTS, resizing
 * the page before each call. Keeps specs terse.
 */
export async function forEachViewport(page, fn) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await fn(page, vp);
  }
}
