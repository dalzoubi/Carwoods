/**
 * Per-flow notification channel defaults.
 *
 * Resolution order (highest wins):
 *   1. notification_scope_overrides (REQUEST)
 *   2. notification_scope_overrides (PROPERTY)
 *   3. user_notification_flow_preferences (per event code, sparse)
 *   4. user_notification_preferences (global per-user toggles)
 *   5. NOTIFICATION_FLOW_DEFAULTS[eventCode]  (this file)
 *   6. hard-coded fallback: in-app=on, email=on, sms=off
 *
 * Mandatory flows (userOverridable=false) always deliver on every listed
 * channel regardless of any user preference or scope override.
 */

import type { NotificationEventCategory } from '../lib/notificationPolicyRepo.js';

export type NotificationFlowRole = 'TENANT' | 'LANDLORD' | 'ADMIN' | 'ANY';

export type NotificationFlowDefault = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  /** When false, user preferences cannot turn this flow off (e.g. SECURITY_*). */
  userOverridable: boolean;
  /** When true, quiet-hours suppression is bypassed for this flow. */
  quietHoursBypass: boolean;
  /** Primary intended recipient role (informational only). */
  role: NotificationFlowRole;
  /** Event category the flow rolls up to for scope override resolution. */
  category: NotificationEventCategory;
  /** i18n key for the human-readable flow label shown in the profile matrix. */
  labelKey: string;
  /** i18n key for the info-icon help body shown in the profile matrix. */
  infoKey: string;
};

export const NOTIFICATION_FLOW_DEFAULTS: Record<string, NotificationFlowDefault> = {
  // ---- Account / onboarding ----
  ACCOUNT_ONBOARDED_WELCOME: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'ANY',
    category: 'ONBOARDING',
    labelKey: 'portalProfile.flows.ACCOUNT_ONBOARDED_WELCOME.label',
    infoKey: 'portalProfile.flows.ACCOUNT_ONBOARDED_WELCOME.info',
  },
  ACCOUNT_EMAIL_VERIFICATION: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: false,
    quietHoursBypass: true,
    role: 'ANY',
    category: 'ONBOARDING',
    labelKey: 'portalProfile.flows.ACCOUNT_EMAIL_VERIFICATION.label',
    infoKey: 'portalProfile.flows.ACCOUNT_EMAIL_VERIFICATION.info',
  },
  ACCOUNT_LANDLORD_CREATED: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'ADMIN',
    category: 'ONBOARDING',
    labelKey: 'portalProfile.flows.ACCOUNT_LANDLORD_CREATED.label',
    infoKey: 'portalProfile.flows.ACCOUNT_LANDLORD_CREATED.info',
  },

  // ---- Maintenance requests ----
  REQUEST_CREATED: {
    inApp: true,
    email: true,
    sms: true,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'LANDLORD',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_CREATED.label',
    infoKey: 'portalProfile.flows.REQUEST_CREATED.info',
  },
  REQUEST_MESSAGE_CREATED: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'ANY',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_MESSAGE_CREATED.label',
    infoKey: 'portalProfile.flows.REQUEST_MESSAGE_CREATED.info',
  },
  REQUEST_ATTACHMENT_ADDED: {
    inApp: true,
    email: false,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'ANY',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_ATTACHMENT_ADDED.label',
    infoKey: 'portalProfile.flows.REQUEST_ATTACHMENT_ADDED.info',
  },
  REQUEST_CANCELLED: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'LANDLORD',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_CANCELLED.label',
    infoKey: 'portalProfile.flows.REQUEST_CANCELLED.info',
  },
  REQUEST_STATUS_CHANGED: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'ANY',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_STATUS_CHANGED.label',
    infoKey: 'portalProfile.flows.REQUEST_STATUS_CHANGED.info',
  },

  // ---- Elsa (AI assistant) ----
  REQUEST_ELSA_REVIEW_PENDING: {
    inApp: true,
    email: true,
    sms: true,
    userOverridable: true,
    quietHoursBypass: true,
    role: 'LANDLORD',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_ELSA_REVIEW_PENDING.label',
    infoKey: 'portalProfile.flows.REQUEST_ELSA_REVIEW_PENDING.info',
  },
  REQUEST_TENANT_AI_REPLY: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'TENANT',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.REQUEST_TENANT_AI_REPLY.label',
    infoKey: 'portalProfile.flows.REQUEST_TENANT_AI_REPLY.info',
  },

  // ---- Lease / move-out notices ----
  LEASE_NOTICE_GIVEN: {
    inApp: true,
    email: true,
    sms: true,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'LANDLORD',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.LEASE_NOTICE_GIVEN.label',
    infoKey: 'portalProfile.flows.LEASE_NOTICE_GIVEN.info',
  },
  LEASE_NOTICE_CO_SIGNED: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'LANDLORD',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.LEASE_NOTICE_CO_SIGNED.label',
    infoKey: 'portalProfile.flows.LEASE_NOTICE_CO_SIGNED.info',
  },
  LEASE_NOTICE_RESPONDED: {
    inApp: true,
    email: true,
    sms: true,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'TENANT',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.LEASE_NOTICE_RESPONDED.label',
    infoKey: 'portalProfile.flows.LEASE_NOTICE_RESPONDED.info',
  },
  LEASE_NOTICE_WITHDRAWN: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'LANDLORD',
    category: 'MAINTENANCE',
    labelKey: 'portalProfile.flows.LEASE_NOTICE_WITHDRAWN.label',
    infoKey: 'portalProfile.flows.LEASE_NOTICE_WITHDRAWN.info',
  },

  // ---- Contact form (public) ----
  CONTACT_REQUEST_CREATED: {
    inApp: true,
    email: true,
    sms: false,
    userOverridable: true,
    quietHoursBypass: false,
    role: 'ADMIN',
    category: 'ONBOARDING',
    labelKey: 'portalProfile.flows.CONTACT_REQUEST_CREATED.label',
    infoKey: 'portalProfile.flows.CONTACT_REQUEST_CREATED.info',
  },

  // ---- Security / compliance (mandatory) ----
  SECURITY_DELIVERY_FAILURE: {
    inApp: true,
    email: true,
    sms: true,
    userOverridable: false,
    quietHoursBypass: true,
    role: 'ADMIN',
    category: 'SECURITY_COMPLIANCE',
    labelKey: 'portalProfile.flows.SECURITY_DELIVERY_FAILURE.label',
    infoKey: 'portalProfile.flows.SECURITY_DELIVERY_FAILURE.info',
  },
};

export function getFlowDefault(eventTypeCode: string): NotificationFlowDefault | null {
  const code = String(eventTypeCode ?? '').trim().toUpperCase();
  return NOTIFICATION_FLOW_DEFAULTS[code] ?? null;
}

/** All event codes a given role can meaningfully override in the profile page. */
export function listOverridableFlowsForRole(role: NotificationFlowRole): string[] {
  return Object.entries(NOTIFICATION_FLOW_DEFAULTS)
    .filter(([, f]) => f.userOverridable && (f.role === 'ANY' || f.role === role))
    .map(([code]) => code);
}
