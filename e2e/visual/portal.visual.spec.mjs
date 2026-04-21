/**
 * Visual regression for the authenticated tenant-onboarding portal.
 *
 * Uses the dev-auth production build (`VITE_PORTAL_DEV_AUTH=true`) so routes render inside the
 * portal shell; see `usePortalDevAuthWebBuild()` in playwright.config.mjs (`PORTAL_E2E=true`, or
 * `--project=visual-chromium`, or running paths under `e2e/visual/`).
 */
import { test, snap, forEachViewport } from './fixtures.mjs';

const PORTAL_ROUTES = [
  { path: '/portal', slug: 'dashboard' },
  { path: '/portal/profile', slug: 'profile' },
  { path: '/portal/requests', slug: 'requests' },
  { path: '/portal/payments', slug: 'payments' },
  { path: '/portal/documents', slug: 'documents' },
  { path: '/portal/status', slug: 'status' },
  { path: '/portal/inbox', slug: 'inbox' },
  { path: '/portal/inbox/notifications', slug: 'inbox-notifications' },
  // Landlord-accessible routes (dev-auth runs as LANDLORD per src/PortalAuthContext.jsx:70-112)
  { path: '/portal/tenants', slug: 'tenants' },
  { path: '/portal/properties', slug: 'properties' },
  { path: '/portal/notices', slug: 'notices' },
];

test.describe('Visual: portal (authenticated)', () => {
  for (const { path, slug } of PORTAL_ROUTES) {
    test(slug, async ({ page }) => {
      await page.goto(path);
      await forEachViewport(page, async (p, vp) => {
        await snap(p, `portal-${slug}-${vp.name}`);
      });
    });
  }
});
