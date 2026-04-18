import { describe, expect, it } from 'vitest';
import { Role } from '../domain/constants.js';
import { buildPortalTourSteps, getPortalTourNavKeys } from './buildPortalTourSteps.js';

describe('getPortalTourNavKeys', () => {
  it('includes dashboard, inbox, documents, and ledger for active tenant', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.TENANT,
      isGuest: false,
      roleResolved: true,
    });
    expect(keys).toEqual(['dashboard', 'inbox', 'documents', 'payments', 'profile']);
  });

  it('omits inbox and profile for guests', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.TENANT,
      isGuest: true,
      roleResolved: true,
    });
    expect(keys).toEqual(['dashboard']);
  });

  it('includes admin and health links for admin', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.ADMIN,
      isGuest: false,
      roleResolved: true,
    });
    expect(keys).toContain('admin');
    expect(keys).toContain('health-status');
    expect(keys).toContain('health-notification-test');
  });
});

describe('buildPortalTourSteps', () => {
  it('orders top chrome after nav and ends with page content', () => {
    const steps = buildPortalTourSteps({
      isMobile: false,
      showAppearanceMenu: true,
      showNotifications: true,
      showAccount: true,
      normalizedRole: Role.TENANT,
      isGuest: false,
      roleResolved: true,
    });
    expect(steps[0].targetId).toBe('portal-tour-nav-dashboard');
    expect(steps[steps.length - 1].targetId).toBe('portal-tour-page-content');
    const ids = steps.map((s) => s.targetId);
    expect(ids).toContain('portal-language-button');
    expect(ids).toContain('portal-tour-help');
  });

  it('inserts mobile menu first on small screens', () => {
    const steps = buildPortalTourSteps({
      isMobile: true,
      showAppearanceMenu: false,
      showNotifications: true,
      showAccount: true,
      normalizedRole: Role.TENANT,
      isGuest: true,
      roleResolved: true,
    });
    expect(steps[0].targetId).toBe('portal-tour-mobile-menu');
  });
});
