import { Role } from '../domain/constants.js';

/**
 * @param {{ normalizedRole: string, isGuest: boolean, roleResolved: boolean, showDocumentsNav?: boolean }} p
 * @returns {string[]} Ordered nav item keys — matches the PortalSidebar rendering order.
 */
export function getPortalTourNavKeys({
  normalizedRole,
  isGuest,
  roleResolved,
  showDocumentsNav = true,
}) {
  /** @type {string[]} */
  const keys = ['dashboard'];

  const isLandlordOrAdmin = normalizedRole === Role.LANDLORD || normalizedRole === Role.ADMIN;

  // manage group (landlord/admin)
  if (roleResolved && isLandlordOrAdmin) {
    keys.push('properties', 'tenants');
  }

  // tools group (non-guest)
  if (roleResolved && !isGuest) {
    if (normalizedRole === Role.TENANT) {
      keys.push('my-lease');
    }
    if (isLandlordOrAdmin) {
      keys.push('notices');
    }
    keys.push('payments');
    if (showDocumentsNav) {
      keys.push('documents');
    }
  }

  // messages group (non-guest)
  if (roleResolved && !isGuest) {
    keys.push('inbox', 'notifications');
    if (normalizedRole === Role.ADMIN) {
      keys.push('contact');
    }
  }

  // admin + health (admin only)
  if (roleResolved && normalizedRole === Role.ADMIN) {
    keys.push('admin', 'health-status', 'health-notification-test');
  }

  // profile (non-guest, rendered at the bottom of the sidebar)
  if (roleResolved && !isGuest) {
    keys.push('profile');
  }

  return keys;
}

const NAV_I18N = {
  dashboard: 'dashboard',
  admin: 'admin',
  properties: 'properties',
  tenants: 'tenants',
  'my-lease': 'myLease',
  notices: 'notices',
  inbox: 'inbox',
  notifications: 'notifications',
  contact: 'contact',
  documents: 'documents',
  payments: 'payments',
  profile: 'profile',
  'health-status': 'healthStatus',
  'health-notification-test': 'healthNotificationTest',
};

/**
 * @param {{
 *   isMobile: boolean,
 *   showAppearanceMenu: boolean,
 *   showNotifications: boolean,
 *   showAccount: boolean,
 *   normalizedRole: string,
 *   isGuest: boolean,
 *   roleResolved: boolean,
 *   showDocumentsNav?: boolean,
 * }} params
 * @returns {{ targetId: string, titleKey: string, bodyKey: string }[]}
 */
export function buildPortalTourSteps({
  isMobile,
  showAppearanceMenu,
  showNotifications,
  showAccount,
  normalizedRole,
  isGuest,
  roleResolved,
  showDocumentsNav = true,
}) {
  const navKeys = getPortalTourNavKeys({ normalizedRole, isGuest, roleResolved, showDocumentsNav });
  const steps = [];

  if (isMobile) {
    steps.push({
      targetId: 'portal-tour-mobile-menu',
      titleKey: 'portalTour.steps.mobileMenu.title',
      bodyKey: 'portalTour.steps.mobileMenu.body',
    });
  }

  for (const key of navKeys) {
    const slug = NAV_I18N[key] ?? key;
    steps.push({
      targetId: `portal-tour-nav-${key}`,
      titleKey: `portalTour.steps.nav.${slug}.title`,
      bodyKey: `portalTour.steps.nav.${slug}.body`,
    });
  }

  if (showAppearanceMenu) {
    steps.push({
      targetId: 'portal-appearance-button',
      titleKey: 'portalTour.steps.appearance.title',
      bodyKey: 'portalTour.steps.appearance.body',
    });
  }

  steps.push(
    {
      targetId: 'portal-tour-help',
      titleKey: 'portalTour.steps.help.title',
      bodyKey: 'portalTour.steps.help.body',
    },
    {
      targetId: 'portal-language-button',
      titleKey: 'portalTour.steps.language.title',
      bodyKey: 'portalTour.steps.language.body',
    }
  );

  if (showNotifications) {
    steps.push({
      targetId: 'portal-notifications-button',
      titleKey: 'portalTour.steps.notifications.title',
      bodyKey: 'portalTour.steps.notifications.body',
    });
  }

  if (showAccount) {
    steps.push({
      targetId: 'portal-topbar-account-button',
      titleKey: 'portalTour.steps.account.title',
      bodyKey: 'portalTour.steps.account.body',
    });
  }

  steps.push({
    targetId: 'portal-tour-page-content',
    titleKey: 'portalTour.steps.pageContent.title',
    bodyKey: 'portalTour.steps.pageContent.body',
  });

  return steps;
}
