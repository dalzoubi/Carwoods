/**
 * Update the authenticated user's own profile.
 *
 * Business rules:
 * - Email is required and must be valid.
 * - Optional fields: first_name, last_name, phone.
 */

import { findUserByEmail, updateUserProfile, updateUserUiPreferences, type UserRow } from '../../lib/usersRepo.js';
import {
  ensureUserNotificationPreference,
  updateUserNotificationPreference,
  listUserNotificationFlowPreferences,
  upsertUserNotificationFlowPreference,
  type UserNotificationPreferenceRow,
  type UserNotificationFlowPreferenceRow,
} from '../../lib/notificationPolicyRepo.js';
import { normalizeQuietHoursPreference } from '../../lib/notificationQuietHours.js';
import { getFlowDefault } from '../../config/notificationFlowDefaults.js';
import { validateProfileUpdate } from '../../domain/userValidation.js';
import { conflictError, notFound, validationError } from '../../domain/errors.js';
import type { Queryable } from '../types.js';

export type UpdateProfileInput = {
  actorUserId: string;
  actorRole: string;
  email: string | undefined;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  uiLanguage?: string | null;
  uiColorScheme?: string | null;
  /** When present (hasOwnProperty), persisted via `updateUserUiPreferences`. */
  portalTourCompleted?: boolean;
  notificationPreferences?: {
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    smsOptIn?: boolean;
    quietHours?: {
      timezone?: string | null;
      startMinute?: number | null;
      endMinute?: number | null;
    };
  };
  /**
   * Per-flow channel preferences. Each entry overrides the compile-time
   * default for one event type. `null` on a channel means "clear the
   * override back to the flow default".
   */
  notificationFlowPreferences?: Array<{
    eventTypeCode: string;
    emailEnabled?: boolean | null;
    inAppEnabled?: boolean | null;
    smsEnabled?: boolean | null;
  }>;
};

export type UpdateProfileOutput = {
  user: UserRow;
  notificationPreferences: UserNotificationPreferenceRow;
  notificationFlowPreferences: UserNotificationFlowPreferenceRow[];
};

export async function updateProfile(
  db: Queryable,
  input: UpdateProfileInput
): Promise<UpdateProfileOutput> {
  const smsEnabled = Boolean(input.notificationPreferences?.smsEnabled);
  const smsOptIn = Boolean(input.notificationPreferences?.smsOptIn);
  const normalizedPhone = String(input.phone ?? '').trim();
  if ((smsEnabled || smsOptIn) && !normalizedPhone) {
    throw validationError('sms_phone_required');
  }

  const validation = validateProfileUpdate({
    email: input.email,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    phone: input.phone ?? undefined,
  });
  if (!validation.valid) throw validationError(validation.message);

  const existingByEmail = await findUserByEmail(db, input.email!);
  if (existingByEmail && existingByEmail.id !== input.actorUserId) {
    throw conflictError('email_already_in_use');
  }

  let updated: UserRow | null;
  try {
    updated = await updateUserProfile(db, input.actorUserId, {
      email: input.email!,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
    });
  } catch (error) {
    // Handles race conditions when another request claims the email first.
    const message = String((error as { message?: string })?.message ?? '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      throw conflictError('email_already_in_use');
    }
    throw error;
  }

  if (!updated) throw notFound();

  const hasUiLanguage = Object.prototype.hasOwnProperty.call(input, 'uiLanguage');
  const hasUiColorScheme = Object.prototype.hasOwnProperty.call(input, 'uiColorScheme');
  const hasPortalTourCompleted = Object.prototype.hasOwnProperty.call(input, 'portalTourCompleted');
  if (hasUiLanguage || hasUiColorScheme || hasPortalTourCompleted) {
    const withPrefs = await updateUserUiPreferences(db, input.actorUserId, {
      ...(hasUiLanguage ? { uiLanguage: input.uiLanguage ?? null } : {}),
      ...(hasUiColorScheme ? { uiColorScheme: input.uiColorScheme ?? null } : {}),
      ...(hasPortalTourCompleted ? { portalTourCompleted: input.portalTourCompleted } : {}),
    });
    if (withPrefs) updated = withPrefs;
  }
  const notificationPreferences = input.notificationPreferences
    ? await updateUserNotificationPreference(db, {
        userId: input.actorUserId,
        emailEnabled: input.notificationPreferences.emailEnabled,
        inAppEnabled: input.notificationPreferences.inAppEnabled,
        smsEnabled: input.notificationPreferences.smsEnabled,
        smsOptIn: input.notificationPreferences.smsOptIn,
        quietHours:
          input.notificationPreferences.quietHours === undefined
            ? undefined
            : normalizeQuietHoursPreference(input.notificationPreferences.quietHours),
      })
    : await ensureUserNotificationPreference(db, input.actorUserId);

  if (Array.isArray(input.notificationFlowPreferences)) {
    for (const entry of input.notificationFlowPreferences) {
      const code = String(entry?.eventTypeCode ?? '').trim().toUpperCase();
      const flowDefault = getFlowDefault(code);
      if (!flowDefault) throw validationError('unknown_event_type_code');
      if (!flowDefault.userOverridable) throw validationError('flow_not_user_overridable');
      await upsertUserNotificationFlowPreference(db, {
        userId: input.actorUserId,
        eventTypeCode: code,
        emailEnabled: entry.emailEnabled,
        inAppEnabled: entry.inAppEnabled,
        smsEnabled: entry.smsEnabled,
      });
    }
  }
  const notificationFlowPreferences = await listUserNotificationFlowPreferences(
    db,
    input.actorUserId
  );

  return { user: updated, notificationPreferences, notificationFlowPreferences };
}
