/**
 * Session security configuration for the Carwoods portal.
 *
 * Controls idle-timeout, absolute-session cap, and "Keep me signed in"
 * persistence behavior. Values chosen to match comparable property-management
 * SaaS (AppFolio, Buildium, Stessa) and Google Workspace admin defaults.
 */

/** User must interact within this window or the session ends. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Warning modal appears this long before the idle timeout fires. */
export const IDLE_WARNING_MS = 60 * 1000;

/** Absolute max session lifetime for default (tab-scoped) sessions. */
export const ABSOLUTE_SESSION_DEFAULT_MS = 12 * 60 * 60 * 1000;

/** Absolute max session lifetime when "Keep me signed in" is opted in. */
export const ABSOLUTE_SESSION_PERSIST_MS = 7 * 24 * 60 * 60 * 1000;

/** How often to check the absolute-session cap while authenticated. */
export const ABSOLUTE_CHECK_INTERVAL_MS = 15 * 1000;

/** Default value of the "Keep me signed in" checkbox at login. */
export const PERSIST_CHECKBOX_DEFAULT = false;

export const SIGNED_IN_AT_KEY = 'carwoods.signedInAt';
export const PERSIST_CHOICE_KEY = 'carwoods.persistChoice';
export const SESSION_BROADCAST_CHANNEL = 'carwoods.session';
export const TERMS_ACCEPTED_KEY = 'carwoods.termsAccepted';

/** DOM events counted as user activity for idle-timeout reset. */
export const IDLE_EVENTS = Object.freeze([
  'mousemove',
  'keydown',
  'click',
  'touchstart',
  'visibilitychange',
]);
