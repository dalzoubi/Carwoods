import { describe, expect, it } from 'vitest';
import { Role } from '../domain/constants.js';
import { buildPortalTourSteps, getPortalTourNavKeys } from './buildPortalTourSteps.js';

describe('getPortalTourNavKeys', () => {
  it('orders tenant nav as dashboard → my-lease → payments → documents → inbox → notifications → profile', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.TENANT,
      isGuest: false,
      roleResolved: true,
    });
    expect(keys).toEqual([
      'dashboard',
      'my-lease',
      'payments',
      'documents',
      'inbox',
      'notifications',
      'profile',
    ]);
  });

  it('hides documents for tenant when Document Center is not available', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.TENANT,
      isGuest: false,
      roleResolved: true,
      showDocumentsNav: false,
    });
    expect(keys).not.toContain('documents');
    // order stays the same otherwise
    expect(keys).toEqual([
      'dashboard',
      'my-lease',
      'payments',
      'inbox',
      'notifications',
      'profile',
    ]);
  });

  it('omits everything except dashboard for guests', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.TENANT,
      isGuest: true,
      roleResolved: true,
    });
    expect(keys).toEqual(['dashboard']);
  });

  it('orders landlord nav with properties, tenants, notices then tools + messages + profile', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.LANDLORD,
      isGuest: false,
      roleResolved: true,
    });
    expect(keys).toEqual([
      'dashboard',
      'properties',
      'tenants',
      'notices',
      'payments',
      'documents',
      'inbox',
      'notifications',
      'profile',
    ]);
  });

  it('orders AI agent nav with tools and messages only (no landlord/admin items)', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.AI_AGENT,
      isGuest: false,
      roleResolved: true,
    });
    expect(keys).toEqual([
      'dashboard',
      'payments',
      'documents',
      'inbox',
      'notifications',
      'profile',
    ]);
  });

  it('orders admin nav with notices, contact and admin/health groups before profile', () => {
    const keys = getPortalTourNavKeys({
      normalizedRole: Role.ADMIN,
      isGuest: false,
      roleResolved: true,
    });
    expect(keys).toEqual([
      'dashboard',
      'properties',
      'tenants',
      'notices',
      'payments',
      'documents',
      'inbox',
      'notifications',
      'contact',
      'admin',
      'reports-notifications',
      'health-status',
      'health-notification-test',
      'profile',
    ]);
  });
});

describe('buildPortalTourSteps', () => {
  it('orders top chrome after nav and ends with page content', () => {
    const steps = buildPortalTourSteps({
      isMobile: false,
      showNotifications: true,
      showAccount: true,
      showSidebarSignOut: true,
      normalizedRole: Role.TENANT,
      isGuest: false,
      roleResolved: true,
    });
    expect(steps[0].targetId).toBe('portal-tour-nav-dashboard');
    expect(steps[steps.length - 1].targetId).toBe('portal-tour-page-content');
    const ids = steps.map((s) => s.targetId);
    expect(ids).toContain('portal-language-button');
    expect(ids).toContain('portal-tour-help');
    expect(ids).toContain('portal-tour-nav-my-lease');
    expect(ids).toContain('portal-tour-sidebar-sign-out');
    expect(ids).toContain('portal-tour-sidebar-back-to-site');
  });

  it('inserts mobile menu first on small screens', () => {
    const steps = buildPortalTourSteps({
      isMobile: true,
      showNotifications: true,
      showAccount: true,
      showSidebarSignOut: false,
      normalizedRole: Role.TENANT,
      isGuest: true,
      roleResolved: true,
    });
    expect(steps[0].targetId).toBe('portal-tour-mobile-menu');
    const ids = steps.map((s) => s.targetId);
    expect(ids).toContain('portal-tour-sidebar-back-to-site');
    expect(ids).not.toContain('portal-tour-sidebar-sign-out');
  });
});
