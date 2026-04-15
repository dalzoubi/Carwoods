/**
 * Returns a locale-aware relative time string (e.g. "2 hours ago").
 * Uses Intl.RelativeTimeFormat when available, falls back to a short absolute date.
 *
 * @param {string|Date} date
 * @param {string} [locale]
 * @returns {string}
 */

function trimStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Parses a portal maintenance-requests deep link for request id and optional highlight targets.
 * Supports `/portal/requests?…` and `/dark/portal/requests?…` with `hlMsg`, `hlAtt`, `hlDec`.
 *
 * @param {string | null | undefined} deepLink
 * @returns {{ requestId: string, highlight: { messageId: string, attachmentId: string, decisionId: string } }}
 */
export function parsePortalRequestDeepLink(deepLink) {
  const emptyHighlight = { messageId: '', attachmentId: '', decisionId: '' };
  if (!deepLink || typeof deepLink !== 'string') {
    return { requestId: '', highlight: { ...emptyHighlight } };
  }
  const qIndex = deepLink.indexOf('?');
  const pathPart = (qIndex === -1 ? deepLink : deepLink.slice(0, qIndex)).split('#')[0];
  const normalized = pathPart.replace(/^\/dark(?=\/)/, '') || '/';
  if (!/\/portal\/requests\/?$/.test(normalized)) {
    return { requestId: '', highlight: { ...emptyHighlight } };
  }
  const q = qIndex === -1 ? '' : deepLink.slice(qIndex).split('#')[0];
  try {
    const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
    return {
      requestId: trimStr(params.get('id')),
      highlight: {
        messageId: trimStr(params.get('hlMsg')),
        attachmentId: trimStr(params.get('hlAtt')),
        decisionId: trimStr(params.get('hlDec')),
      },
    };
  } catch {
    return { requestId: '', highlight: { ...emptyHighlight } };
  }
}

/**
 * If `deepLink` targets the portal maintenance requests page with an `id` query, returns that id.
 * Supports paths like `/portal/requests?id=…` and `/dark/portal/requests?id=…`.
 *
 * @param {string | null | undefined} deepLink
 * @returns {string}
 */
export function parsePortalRequestIdFromDeepLink(deepLink) {
  return parsePortalRequestDeepLink(deepLink).requestId;
}

/**
 * Resolves request id and scroll/highlight targets for opening from a notification row.
 * Merges URL query params with `metadata_json` so older notifications still focus when metadata has ids.
 *
 * @param {{ deep_link?: string|null, metadata_json?: unknown }} notification
 * @returns {{ requestId: string, highlight: { messageId?: string, attachmentId?: string, decisionId?: string } }}
 */
export function notificationOpenTargetFromRow(notification) {
  const fromLink = parsePortalRequestDeepLink(notification?.deep_link);
  const meta = notification?.metadata_json && typeof notification.metadata_json === 'object'
    ? notification.metadata_json
    : {};
  const metaMsg = trimStr(meta.message_id);
  const metaAtt = trimStr(meta.attachment_id);
  const metaDec = trimStr(meta.decision_id);

  const highlight = {};
  const msg = fromLink.highlight.messageId || metaMsg;
  const att = fromLink.highlight.attachmentId || metaAtt;
  const dec = fromLink.highlight.decisionId || metaDec;
  if (msg) highlight.messageId = msg;
  if (att) highlight.attachmentId = att;
  if (dec) highlight.decisionId = dec;

  return {
    requestId: fromLink.requestId,
    highlight,
  };
}

/**
 * Locale-aware absolute date+time (for tooltips on relative-time labels).
 *
 * @param {string|Date} date
 * @param {string} [locale]
 * @returns {string}
 */
export function formatNotificationAbsoluteTime(date, locale) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale ?? 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toISOString();
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
