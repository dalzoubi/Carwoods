import { describe, expect, it } from 'vitest';
import {
  notificationOpenTargetFromRow,
  parsePortalRequestDeepLink,
  parsePortalRequestIdFromDeepLink,
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
