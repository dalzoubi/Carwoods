/**
 * CTIA / Telnyx toll-free verification SMS opt-in consent constants.
 *
 * The consent text version is persisted with every opt-in so we can audit
 * precisely which disclosures the user agreed to. Whenever the wording
 * changes we bump the version constant.
 */

export const SMS_OPT_IN_VERSION = '2026-04-21.v1';

export const SMS_OPT_IN_SOURCE_WEB_PORTAL = 'WEB_PORTAL_PROFILE';

/**
 * Canonical disclosure text for the Carwoods SMS opt-in confirmation dialog.
 *
 * Duplicated on the frontend (via i18n) for display. Kept here so backend
 * tests and compliance docs have a single source-of-truth string.
 */
export const SMS_OPT_IN_DISCLOSURE = [
  'By enabling SMS notifications, you agree to receive transactional text messages from Carwoods related to your account, including maintenance updates, lease notices, and account alerts.',
  'Message frequency varies. Message and data rates may apply.',
  'Reply STOP to opt out at any time. Reply HELP for help.',
  'Consent is not a condition of purchase. Messages are only sent based on your activity and notification settings.',
].join('\n\n');

/**
 * Standard HELP auto-reply for inbound HELP keywords on the Carwoods SMS
 * channel. Carriers require that HELP returns a branded, informational
 * message that points users to a human support path.
 */
export const SMS_HELP_REPLY =
  'Carwoods: For help, reply HELP or contact support@carwoods.com. Log in to your account to manage notification settings: https://carwoods.com/portal/profile. Message frequency varies. Message and data rates may apply.';

/** Confirmation reply sent when a user opts out via STOP keyword. */
export const SMS_STOP_REPLY =
  'Carwoods: You are opted out and will not receive further messages. Log in at https://carwoods.com/portal/profile to re-enable SMS notifications.';

/**
 * Inbound keywords that must opt a recipient out, per CTIA guidelines.
 * Match case-insensitively after trimming whitespace.
 */
export const SMS_STOP_KEYWORDS = [
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
] as const;

export const SMS_HELP_KEYWORDS = ['HELP', 'INFO'] as const;

export function isSmsStopKeyword(raw: string): boolean {
  const upper = String(raw ?? '').trim().toUpperCase();
  return SMS_STOP_KEYWORDS.some((kw) => kw === upper);
}

export function isSmsHelpKeyword(raw: string): boolean {
  const upper = String(raw ?? '').trim().toUpperCase();
  return SMS_HELP_KEYWORDS.some((kw) => kw === upper);
}
