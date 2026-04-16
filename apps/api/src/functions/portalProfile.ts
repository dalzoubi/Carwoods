import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, mapDomainError, requirePortalUser } from '../lib/managementRequest.js';

import { clampQuietHoursMinuteOfDay } from '../lib/notificationQuietHours.js';
import { updateProfile } from '../useCases/users/updateProfile.js';
import { updateUserUiPreferences, findUserById } from '../lib/usersRepo.js';
import { addProfilePhotoReadUrl } from '../lib/userProfilePhotoUrl.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function minuteOrUndef(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return clampQuietHoursMinuteOfDay(Math.floor(n));
}

async function portalProfileHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const {
    ctx: { user, headers },
  } = gate;

  if (request.method !== 'PATCH') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }

  const payload = asRecord(body);

  const hasEmail = Object.prototype.hasOwnProperty.call(payload, 'email');
  const hasUiLanguage = Object.prototype.hasOwnProperty.call(payload, 'ui_language');
  const hasUiColorScheme = Object.prototype.hasOwnProperty.call(payload, 'ui_color_scheme');
  const hasPortalTourCompleted = Object.prototype.hasOwnProperty.call(payload, 'portal_tour_completed');

  // UI-preferences-only PATCH: no email/name/phone/notification fields.
  // Bypass the full updateProfile flow (which requires a valid email) and write
  // directly so background syncs from the nav menus work without a full form submit.
  const isUiPrefsOnly = !hasEmail
    && !Object.prototype.hasOwnProperty.call(payload, 'first_name')
    && !Object.prototype.hasOwnProperty.call(payload, 'last_name')
    && !Object.prototype.hasOwnProperty.call(payload, 'phone')
    && !Object.prototype.hasOwnProperty.call(payload, 'notification_preferences')
    && (hasUiLanguage || hasUiColorScheme || hasPortalTourCompleted);

  if (isUiPrefsOnly) {
    const portalTourCompleted = hasPortalTourCompleted ? bool(payload.portal_tour_completed) : undefined;
    if (hasPortalTourCompleted && portalTourCompleted === undefined) {
      return jsonResponse(400, headers, { error: 'invalid_portal_tour_completed' });
    }
    try {
      const pool = getPool();
      const updated = await updateUserUiPreferences(pool, user.id, {
        ...(hasUiLanguage ? { uiLanguage: str(payload.ui_language) ?? null } : {}),
        ...(hasUiColorScheme ? { uiColorScheme: str(payload.ui_color_scheme) ?? null } : {}),
        ...(portalTourCompleted !== undefined ? { portalTourCompleted } : {}),
      });
      const row = updated ?? (await findUserById(pool, user.id)) ?? user;
      return jsonResponse(200, headers, {
        user: {
          ...addProfilePhotoReadUrl(row),
          ui_language: row.ui_language ?? null,
          ui_color_scheme: row.ui_color_scheme ?? null,
          portal_tour_completed: Boolean(row.portal_tour_completed),
        },
      });
    } catch (e) {
      const mapped = mapDomainError(e, headers);
      if (mapped) return mapped;
      throw e;
    }
  }

  try {
    const result = await updateProfile(getPool(), {
      actorUserId: user.id,
      actorRole: String(user.role ?? '').trim().toUpperCase(),
      email: str(payload.email),
      firstName: str(payload.first_name) ?? null,
      lastName: str(payload.last_name) ?? null,
      phone: str(payload.phone) ?? null,
      ...(hasUiLanguage ? { uiLanguage: str(payload.ui_language) ?? null } : {}),
      ...(hasUiColorScheme ? { uiColorScheme: str(payload.ui_color_scheme) ?? null } : {}),
      notificationPreferences: (() => {
        const raw = asRecord(payload.notification_preferences);
        const emailEnabled = bool(raw.email_enabled);
        const inAppEnabled = bool(raw.in_app_enabled);
        const smsEnabled = bool(raw.sms_enabled);
        const smsOptIn = bool(raw.sms_opt_in);
        const qhRaw = asRecord(raw.quiet_hours);
        const hasQuietHours = Object.prototype.hasOwnProperty.call(raw, 'quiet_hours');
        const quietHours = hasQuietHours
          ? {
              timezone: str(qhRaw.timezone) ?? null,
              startMinute: minuteOrUndef(qhRaw.start_minute),
              endMinute: minuteOrUndef(qhRaw.end_minute),
            }
          : undefined;
        if (
          emailEnabled === undefined
          && inAppEnabled === undefined
          && smsEnabled === undefined
          && smsOptIn === undefined
          && !hasQuietHours
        ) {
          return undefined;
        }
        return {
          emailEnabled,
          inAppEnabled,
          smsEnabled,
          smsOptIn,
          quietHours,
        };
      })(),
    });
    return jsonResponse(200, headers, {
      user: {
        ...addProfilePhotoReadUrl(result.user),
        ui_language: result.user.ui_language ?? null,
        ui_color_scheme: result.user.ui_color_scheme ?? null,
        portal_tour_completed: Boolean(result.user.portal_tour_completed),
      },
      notification_preferences: result.notificationPreferences,
    });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

app.http('portalProfile', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/profile',
  handler: portalProfileHandler,
});
