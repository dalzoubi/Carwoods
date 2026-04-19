/**
 * Visual regression for admin / landlord-only portal pages.
 *
 * Requires PORTAL_E2E=true. Dev-auth logs in as LANDLORD, so routes that
 * are strictly Role.ADMIN (`/portal/admin/landlords`,
 * `/portal/admin/health/notification-test`) will render the guard screen,
 * not the admin UI. Capturing those additional pages requires extending
 * dev-auth to accept a role override — tracked in docs/visual-testing.md.
 */
import { test, snap, forEachViewport } from './fixtures.mjs';

const isPortalE2E = process.env.PORTAL_E2E === 'true';

const ADMIN_ROUTES = [
  // LANDLORD + ADMIN — renders the AI settings page.
  { path: '/portal/admin/config', slug: 'admin-config' },
  // ADMIN-only routes. With the current LANDLORD dev-auth these render the
  // route guard's "not authorized" screen, which is itself worth snapshotting
  // so the guard UI doesn't silently regress.
  { path: '/portal/admin/landlords', slug: 'admin-landlords-guard' },
  { path: '/portal/admin/health/notification-test', slug: 'admin-notification-test-guard' },
];

test.describe('Visual: admin', () => {
  test.skip(
    !isPortalE2E,
    'Skipped — set PORTAL_E2E=true to run admin visual regression.',
  );

  for (const { path, slug } of ADMIN_ROUTES) {
    test(slug, async ({ page }) => {
      await page.goto(path);
      await forEachViewport(page, async (p, vp) => {
        await snap(p, `admin-${slug}-${vp.name}`);
      });
    });
  }
});
