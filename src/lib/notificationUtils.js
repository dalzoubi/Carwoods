/**
 * Returns a locale-aware relative time string (e.g. "2 hours ago").
 * Uses Intl.RelativeTimeFormat when available, falls back to a short absolute date.
 *
 * @param {string|Date} date
 * @param {string} [locale]
 * @returns {string}
 */
/**
 * If `deepLink` targets the portal maintenance requests page with an `id` query, returns that id.
 * Supports paths like `/portal/requests?id=…` and `/dark/portal/requests?id=…`.
 *
 * @param {string | null | undefined} deepLink
 * @returns {string}
 */
export function parsePortalRequestIdFromDeepLink(deepLink) {
  if (!deepLink || typeof deepLink !== 'string') return '';
  const pathPart = deepLink.split('?')[0].split('#')[0];
  const normalized = pathPart.replace(/^\/dark(?=\/)/, '') || '/';
  if (!/\/portal\/requests\/?$/.test(normalized)) return '';
  const q = deepLink.includes('?') ? deepLink.slice(deepLink.indexOf('?')).split('#')[0] : '';
  try {
    const params = new URLSearchParams(q);
    return String(params.get('id') || '').trim();
  } catch {
    return '';
  }
}

export function relativeTime(date, locale) {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffH = Math.round(diffMin / 60);
  const diffD = Math.round(diffH / 24);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale ?? 'en', { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-diffSec, 'second');
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    if (diffH < 24) return rtf.format(-diffH, 'hour');
    if (diffD < 30) return rtf.format(-diffD, 'day');
    const diffM = Math.round(diffD / 30);
    if (diffM < 12) return rtf.format(-diffM, 'month');
    return rtf.format(-Math.round(diffM / 12), 'year');
  } catch {
    return new Date(date).toLocaleDateString(locale ?? 'en');
  }
}
