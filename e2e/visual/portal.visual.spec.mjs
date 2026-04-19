/**
 * Visual regression for the authenticated tenant-onboarding portal.
 *
 * Requires PORTAL_E2E=true so playwright.config.mjs builds with
 * VITE_PORTAL_DEV_AUTH=true (see playwright.config.mjs:3-5,20-22). Without
 * that env, every auth-gated route redirects to the login landing and the
 * whole suite is skipped instead of producing misleading baselines.
 */
import { test, snap, forEachViewport } from './fixtures.mjs';

const isPortalE2E = process.env.PORTAL_E2E === 'true';

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
  test.skip(
    !isPortalE2E,
    'Skipped — set PORTAL_E2E=true to run visual regression against the authenticated portal.',
  );

  // Also snapshot the unauthenticated login landing — it is its own screen.
  test('login-landing', async ({ page }) => {
    // Force dev-auth off for this one test by clearing the portal session.
    await page.goto('/portal');
    await forEachViewport(page, async (p, vp) => {
      await snap(p, `portal-login-landing-${vp.name}`);
    });
  });

  for (const { path, slug } of PORTAL_ROUTES) {
    test(slug, async ({ page }) => {
      await page.goto(path);
      await forEachViewport(page, async (p, vp) => {
        await snap(p, `portal-${slug}-${vp.name}`);
      });
    });
  }
});
