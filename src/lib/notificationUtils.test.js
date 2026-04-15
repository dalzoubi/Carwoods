import { describe, expect, it } from 'vitest';
import {
  formatNotificationAbsoluteTime,
  notificationOpenTargetFromRow,
  parsePortalRequestDeepLink,
  parsePortalRequestIdFromDeepLink,
  resolveNotificationDeepLink,
} from './notificationUtils';

describe('parsePortalRequestDeepLink', () => {
  it('parses id and highlight params', () => {
    const dl = '/portal/requests?id=req-1&hlMsg=m1&hlAtt=a1&hlDec=d1';
    expect(parsePortalRequestDeepLink(dl)).toEqual({
      requestId: 'req-1',
      highlight: { messageId: 'm1', attachmentId: 'a1', decisionId: 'd1' },
    });
  });

  it('strips /dark prefix on path', () => {
    const dl = '/dark/portal/requests?id=abc&hlMsg=msg';
    expect(parsePortalRequestDeepLink(dl)).toEqual({
      requestId: 'abc',
      highlight: { messageId: 'msg', attachmentId: '', decisionId: '' },
    });
  });

  it('returns empty for non-requests links', () => {
    expect(parsePortalRequestDeepLink('/portal/profile')).toEqual({
      requestId: '',
      highlight: { messageId: '', attachmentId: '', decisionId: '' },
    });
  });
});

describe('parsePortalRequestIdFromDeepLink', () => {
  it('returns only request id', () => {
    expect(parsePortalRequestIdFromDeepLink('/portal/requests?id=x&hlMsg=y')).toBe('x');
  });
});

describe('resolveNotificationDeepLink', () => {
  it('appends hlLandlord for ACCOUNT_LANDLORD_CREATED when metadata has id', () => {
    const url = resolveNotificationDeepLink({
      event_type_code: 'ACCOUNT_LANDLORD_CREATED',
      deep_link: '/portal/admin/landlords',
      metadata_json: { landlord_user_id: 'abc-123', kind: 'landlord_account_created' },
    });
    expect(url).toBe('/portal/admin/landlords?hlLandlord=abc-123');
  });

  it('does not duplicate hlLandlord', () => {
    const url = resolveNotificationDeepLink({
      event_type_code: 'ACCOUNT_LANDLORD_CREATED',
      deep_link: '/portal/admin/landlords?hlLandlord=already',
      metadata_json: { landlord_user_id: 'x' },
    });
    expect(url).toBe('/portal/admin/landlords?hlLandlord=already');
  });

  it('returns deep_link unchanged for other events', () => {
    expect(
      resolveNotificationDeepLink({
        event_type_code: 'REQUEST_CREATED',
        deep_link: '/portal/requests?id=r1',
        metadata_json: {},
      })
    ).toBe('/portal/requests?id=r1');
  });
});

describe('formatNotificationAbsoluteTime', () => {
  it('returns a non-empty locale string for a valid ISO timestamp', () => {
    const s = formatNotificationAbsoluteTime('2020-06-15T14:30:00.000Z', 'en');
    expect(s.length).toBeGreaterThan(5);
    expect(s).toMatch(/\d/);
  });

  it('returns empty for invalid date', () => {
    expect(formatNotificationAbsoluteTime('not-a-date', 'en')).toBe('');
  });
});

describe('notificationOpenTargetFromRow', () => {
  it('merges metadata when URL omits highlight params', () => {
    const row = {
      deep_link: '/portal/requests?id=r1',
      metadata_json: { message_id: 'm99', attachment_id: 'a2' },
    };
    expect(notificationOpenTargetFromRow(row)).toEqual({
      requestId: 'r1',
      highlight: { messageId: 'm99', attachmentId: 'a2' },
    });
  });

  it('prefers URL highlight over metadata', () => {
    const row = {
      deep_link: '/portal/requests?id=r1&hlMsg=from-url',
      metadata_json: { message_id: 'from-meta' },
    };
    expect(notificationOpenTargetFromRow(row).highlight.messageId).toBe('from-url');
  });
});
