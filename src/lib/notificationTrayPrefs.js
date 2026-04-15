/**
 * In-app notification bell (top bar): which IDs the user removed from the tray
 * and how to limit read history shown there. Full history stays on /portal/inbox/notifications.
 */

const STORAGE_KEY_PREFIX = 'portal_notification_tray_hidden_v1';
const MAX_STORED_IDS = 400;

function parseTime(iso) {
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param {Array<{ id?: string, read_at?: string|null, created_at?: string|null }>} notifications
 * @param {Set<string>|Iterable<string>} hiddenIds  Dismissed / removed from bell only
 * @returns {Array} Newest unread first, then up to 2 most recently read (by read_at)
 */
export function selectNotificationsForTray(notifications, hiddenIds) {
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set(hiddenIds);
  const visible = (Array.isArray(notifications) ? notifications : []).filter(
    (n) => n && n.id != null && !hidden.has(String(n.id))
  );

  const unread = visible.filter((n) => !n.read_at);
  const read = visible.filter((n) => Boolean(n.read_at));

  const byCreatedDesc = (a, b) => {
    const byCreated = parseTime(b.created_at) - parseTime(a.created_at);
    if (byCreated !== 0) return byCreated;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  };

  const byReadDesc = (a, b) => {
    const byRead = parseTime(b.read_at) - parseTime(a.read_at);
    if (byRead !== 0) return byRead;
    const byCreated = parseTime(b.created_at) - parseTime(a.created_at);
    if (byCreated !== 0) return byCreated;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  };

  unread.sort(byCreatedDesc);
  read.sort(byReadDesc);
  const topRead = read.slice(0, 2);

  return [...unread, ...topRead];
}

/**
 * @param {string} userKey  Stable per sign-in (e.g. Firebase uid or email)
 * @returns {Set<string>}
 */
export function loadTrayHiddenIds(userKey) {
  if (!userKey || typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${userKey}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

/**
 * Distinct localStorage key segments for this signed-in account (Firebase uid and/or email).
 * Dismissals are written to every key so tray prefs survive `uid` vs email key changes.
 *
 * @param {{ uid?: string|null, username?: string|null }|null|undefined} account
 * @returns {string[]}
 */
export function trayStorageUserKeys(account) {
  if (!account || typeof account !== 'object') return [];
  const uid = typeof account.uid === 'string' && account.uid.trim() ? account.uid.trim() : '';
  const username =
    typeof account.username === 'string' && account.username.trim() ? account.username.trim() : '';
  const keys = [];
  if (uid) keys.push(uid);
  if (username && username !== uid) keys.push(username);
  return keys;
}

/**
 * @param {{ uid?: string|null, username?: string|null }|null|undefined} account
 * @returns {Set<string>}
 */
export function loadMergedTrayHiddenIds(account) {
  const keys = trayStorageUserKeys(account);
  if (keys.length === 0 || typeof window === 'undefined') return new Set();
  const merged = new Set();
  for (const key of keys) {
    for (const id of loadTrayHiddenIds(key)) {
      merged.add(id);
    }
  }
  return merged;
}

/**
 * @param {string} userKey
 * @param {Set<string>} ids
 */
export function saveTrayHiddenIds(userKey, ids) {
  if (!userKey || typeof window === 'undefined') return;
  const arr = [...ids];
  const capped = arr.length > MAX_STORED_IDS ? arr.slice(-MAX_STORED_IDS) : arr;
  window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:${userKey}`, JSON.stringify(capped));
}

/**
 * @param {string} userKey
 * @param {string} notificationId
 * @param {Set<string>} current
 * @returns {Set<string>} Next set (also persisted)
 */
export function addTrayHiddenId(userKey, notificationId, current) {
  const next = new Set(current);
  next.add(String(notificationId));
  saveTrayHiddenIds(userKey, next);
  return next;
}

/**
 * @param {{ uid?: string|null, username?: string|null }|null|undefined} account
 * @param {string|number} notificationId
 * @param {Set<string>} current
 * @returns {Set<string>}
 */
export function addTrayHiddenIdForAccount(account, notificationId, current) {
  const keys = trayStorageUserKeys(account);
  if (keys.length === 0) return new Set(current);
  const next = new Set(current);
  next.add(String(notificationId));
  for (const key of keys) {
    saveTrayHiddenIds(key, next);
  }
  return next;
}
