/**
 * vCard 3.0 helpers for exporting a contact card (.vcf).
 * @see https://www.rfc-editor.org/rfc/rfc2426
 */

/** ORG field value (proper noun; not user-facing UI copy). */
export const VCARD_ORG_NAME = 'Carwoods';

/** @param {unknown} value */
export function escapeVCardText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * @typedef {{ street?: string, locality?: string, region?: string, postalCode?: string, country?: string }} VCardAdr
 */

/**
 * @param {VCardAdr | null | undefined} adr
 * @returns {string} ADR line or empty string when nothing to include
 */
function buildAdrLine(adr) {
  if (!adr) return '';
  const street = String(adr.street ?? '').trim();
  const locality = String(adr.locality ?? '').trim();
  const region = String(adr.region ?? '').trim();
  const postal = String(adr.postalCode ?? '').trim();
  const country = String(adr.country ?? '').trim();
  if (!street && !locality && !region && !postal && !country) return '';
  const poBox = '';
  const extended = '';
  return `ADR;TYPE=HOME:${poBox};${extended};${escapeVCardText(street)};${escapeVCardText(locality)};${escapeVCardText(region)};${escapeVCardText(postal)};${escapeVCardText(country)}`;
}

/**
 * @param {{ firstName?: string, lastName?: string, fallbackEmail?: string }} p
 */
export function resolveVCardDisplayName({ firstName, lastName, fallbackEmail }) {
  const n = `${String(firstName ?? '').trim()} ${String(lastName ?? '').trim()}`.trim();
  return n || String(fallbackEmail ?? '').trim();
}

/**
 * @param {{
 *   firstName?: string,
 *   lastName?: string,
 *   email?: string | null,
 *   phone?: string | null,
 *   adr?: VCardAdr | null,
 *   org?: string | null,
 *   title?: string | null,
 * }} fields
 * @returns {string} CRLF-separated vCard document
 */
export function buildVCard3(fields) {
  const first = String(fields.firstName ?? '').trim();
  const last = String(fields.lastName ?? '').trim();
  const email = String(fields.email ?? '').trim();
  const display = resolveVCardDisplayName({ firstName: first, lastName: last, fallbackEmail: email }) || 'Contact';

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardText(display)}`,
    `N:${escapeVCardText(last)};${escapeVCardText(first)};;;`,
  ];

  const org = String(fields.org ?? '').trim();
  if (org) lines.push(`ORG:${escapeVCardText(org)}`);

  const title = String(fields.title ?? '').trim();
  if (title) lines.push(`TITLE:${escapeVCardText(title)}`);

  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardText(email)}`);

  const tel = String(fields.phone ?? '').trim();
  if (tel) lines.push(`TEL;TYPE=VOICE:${escapeVCardText(tel)}`);

  const adrLine = buildAdrLine(fields.adr);
  if (adrLine) lines.push(adrLine);

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * ASCII-ish filename base for .vcf (avoids empty names for non-Latin display names).
 * @param {...unknown} parts
 */
export function slugifyVCardFilenameBase(...parts) {
  const joined = parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/@/g, '-at-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return joined.slice(0, 72) || 'contact';
}

/**
 * @param {string} filenameBase
 * @param {string} vcardBody
 * @returns {boolean} true when the download was triggered, false on any failure
 */
export function downloadVCard(filenameBase, vcardBody) {
  try {
    const trimmedBase = String(filenameBase ?? 'contact').replace(/\.vcf$/i, '') || 'contact';
    // Cap filename length for filesystem safety across OSes.
    const safeBase = trimmedBase.slice(0, 200);
    const blob = new Blob([vcardBody], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeBase}.vcf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    return true;
  } catch {
    return false;
  }
}
