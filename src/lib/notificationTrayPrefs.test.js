import { describe, expect, it } from 'vitest';
import { selectNotificationsForTray } from './notificationTrayPrefs';

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
