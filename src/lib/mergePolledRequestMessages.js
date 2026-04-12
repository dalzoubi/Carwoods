/**
 * Azure read SAS in message payloads rotates on every JSON response; the blob path is stable.
 * Reuse the previous URL when the same message + sender still points at the same blob path
 * so the browser keeps a single cached image bytes for avatars.
 *
 * @param {unknown} url
 * @returns {string}
 */
export function blobStorageKeyFromProfilePhotoUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '';
  }
}

/**
 * @param {unknown[]} prev
 * @param {unknown[]} next
 * @returns {unknown[]}
 */
export function mergePolledRequestMessages(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return next;
  const prevById = new Map(prev.map((m) => [m && typeof m === 'object' ? m.id : undefined, m]));
  return next.map((m) => {
    if (!m || typeof m !== 'object') return m;
    const old = prevById.get(m.id);
    if (!old || typeof old !== 'object') return m;
    if (old.sender_user_id !== m.sender_user_id) return m;
    const oldKey = blobStorageKeyFromProfilePhotoUrl(old.sender_profile_photo_url);
    const newKey = blobStorageKeyFromProfilePhotoUrl(m.sender_profile_photo_url);
    if (
      oldKey
      && newKey
      && oldKey === newKey
      && typeof old.sender_profile_photo_url === 'string'
      && old.sender_profile_photo_url.trim()
    ) {
      return { ...m, sender_profile_photo_url: old.sender_profile_photo_url };
    }
    return m;
  });
}
