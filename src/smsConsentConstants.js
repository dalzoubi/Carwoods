/**
 * CTIA / Telnyx toll-free SMS opt-in consent version.
 *
 * Kept in sync with `apps/api/src/domain/smsConsent.ts`. When the dialog
 * disclosure text changes, bump this constant so every new consent row is
 * tagged with the version the user saw.
 */
export const SMS_OPT_IN_VERSION = '2026-04-21.v1';

export const SMS_OPT_IN_SOURCE_WEB_PORTAL = 'WEB_PORTAL_PROFILE';
