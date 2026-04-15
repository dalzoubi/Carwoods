import { afterEach, describe, expect, it } from 'vitest';
import {
  addTrayHiddenIdForAccount,
  loadMergedTrayHiddenIds,
  selectNotificationsForTray,
  trayStorageUserKeys,
} from './notificationTrayPrefs';

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
});

describe('selectNotificationsForTray', () => {
  it('returns all unread and at most two read, read ordered by read_at', () => {
    const hidden = new Set();
    const list = [
      { id: 'a', read_at: '2020-01-01T00:00:00Z', created_at: '2019-06-01T00:00:00Z' },
      { id: 'b', read_at: null, created_at: '2020-02-01T00:00:00Z' },
      { id: 'c', read_at: '2020-03-01T00:00:00Z', created_at: '2018-01-01T00:00:00Z' },
      { id: 'd', read_at: '2020-02-15T00:00:00Z', created_at: '2019-01-01T00:00:00Z' },
    ];
    const tray = selectNotificationsForTray(list, hidden);
    expect(tray.map((n) => n.id)).toEqual(['b', 'c', 'd']);
  });

  it('excludes hidden ids', () => {
    const hidden = new Set(['b', 'c']);
    const list = [
      { id: 'a', read_at: null, created_at: '2020-01-01T00:00:00Z' },
      { id: 'b', read_at: null, created_at: '2020-02-01T00:00:00Z' },
      { id: 'c', read_at: '2020-03-01T00:00:00Z', created_at: '2018-01-01T00:00:00Z' },
    ];
    const tray = selectNotificationsForTray(list, hidden);
    expect(tray.map((n) => n.id)).toEqual(['a']);
  });

  it('orders unread by created_at descending', () => {
    const list = [
      { id: 'old', read_at: null, created_at: '2020-01-01T00:00:00Z' },
      { id: 'new', read_at: null, created_at: '2020-06-01T00:00:00Z' },
    ];
    const tray = selectNotificationsForTray(list, new Set());
    expect(tray.map((n) => n.id)).toEqual(['new', 'old']);
  });
});

describe('tray dismiss persistence (uid + email keys)', () => {
  it('trayStorageUserKeys returns uid then email when both differ', () => {
    expect(trayStorageUserKeys({ uid: 'abc', username: 'u@x.com' })).toEqual(['abc', 'u@x.com']);
  });

  it('trayStorageUserKeys omits duplicate when username equals uid', () => {
    expect(trayStorageUserKeys({ uid: 'same', username: 'same' })).toEqual(['same']);
  });

  it('loadMergedTrayHiddenIds unions storage across uid and email keys', () => {
    window.localStorage.setItem(
      'portal_notification_tray_hidden_v1:uid-1',
      JSON.stringify(['n1'])
    );
    window.localStorage.setItem(
      'portal_notification_tray_hidden_v1:a@b.com',
      JSON.stringify(['n2'])
    );
    const merged = loadMergedTrayHiddenIds({ uid: 'uid-1', username: 'a@b.com' });
    expect([...merged].sort()).toEqual(['n1', 'n2']);
  });

  it('addTrayHiddenIdForAccount writes the same set to every storage key', () => {
    const next = addTrayHiddenIdForAccount({ uid: 'uid-1', username: 'a@b.com' }, 'x', new Set(['p']));
    expect([...next].sort()).toEqual(['p', 'x']);
    const rawUid = window.localStorage.getItem('portal_notification_tray_hidden_v1:uid-1');
    const rawEmail = window.localStorage.getItem('portal_notification_tray_hidden_v1:a@b.com');
    expect(JSON.parse(rawUid)).toEqual(expect.arrayContaining(['p', 'x']));
    expect(JSON.parse(rawEmail)).toEqual(expect.arrayContaining(['p', 'x']));
    expect(JSON.parse(rawUid).length).toBe(2);
    expect(JSON.parse(rawEmail).length).toBe(2);
  });
});
