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

function boolOrNull(v: unknown): boolean | null | undefined {
  if (v === null) return null;
  if (typeof v === 'boolean') return v;
  return undefined;
}

function parseFlowPreferences(raw: unknown): Array<{
  eventTypeCode: string;
  emailEnabled?: boolean | null;
  inAppEnabled?: boolean | null;
  smsEnabled?: boolean | null;
}> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<{
    eventTypeCode: string;
    emailEnabled?: boolean | null;
    inAppEnabled?: boolean | null;
    smsEnabled?: boolean | null;
  }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const code = str(record.event_type_code);
    if (!code) continue;
    out.push({
      eventTypeCode: code,
      emailEnabled: boolOrNull(record.email_enabled),
      inAppEnabled: boolOrNull(record.in_app_enabled),
      smsEnabled: boolOrNull(record.sms_enabled),
    });
  }
  return out;
}

function parseSmsOptInConsent(raw: unknown): {
  source?: string;
  version?: string;
  ip?: string | null;
  userAgent?: string | null;
} | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const confirmed = record.confirmed === true;
  if (!confirmed) return undefined;
  return {
    source: str(record.source),
    version: str(record.version),
  };
}

function firstClientIp(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(',')[0]?.trim();
  if (!first) return null;
  return first.slice(0, 64);
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
  const portalTourCompletedParsed = hasPortalTourCompleted ? bool(payload.portal_tour_completed) : undefined;
  if (hasPortalTourCompleted && portalTourCompletedParsed === undefined) {
    return jsonResponse(400, headers, { error: 'invalid_portal_tour_completed' });
  }

  // UI-preferences-only PATCH: no email/name/phone/notification fields.
  // Bypass the full updateProfile flow (which requires a valid email) and write
  // directly so background syncs from the nav menus work without a full form submit.
  const isUiPrefsOnly = !hasEmail
    && !Object.prototype.hasOwnProperty.call(payload, 'first_name')
    && !Object.prototype.hasOwnProperty.call(payload, 'last_name')
    && !Object.prototype.hasOwnProperty.call(payload, 'phone')
    && !Object.prototype.hasOwnProperty.call(payload, 'notification_preferences')
    && !Object.prototype.hasOwnProperty.call(payload, 'notification_flow_preferences')
    && (hasUiLanguage || hasUiColorScheme || hasPortalTourCompleted);

  if (isUiPrefsOnly) {
    try {
      const pool = getPool();
      const updated = await updateUserUiPreferences(pool, user.id, {
        ...(hasUiLanguage ? { uiLanguage: str(payload.ui_language) ?? null } : {}),
        ...(hasUiColorScheme ? { uiColorScheme: str(payload.ui_color_scheme) ?? null } : {}),
        ...(portalTourCompletedParsed !== undefined ? { portalTourCompleted: portalTourCompletedParsed } : {}),
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

  const rawConsent = parseSmsOptInConsent(payload.sms_opt_in_consent);
  const ip = firstClientIp(request.headers.get('x-forwarded-for'))
    ?? firstClientIp(request.headers.get('x-real-ip'));
  const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;
  const smsOptInConsent = rawConsent
    ? {
        ...rawConsent,
        ip,
        userAgent,
      }
    : undefined;

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
      ...(hasPortalTourCompleted ? { portalTourCompleted: portalTourCompletedParsed } : {}),
      ...(smsOptInConsent ? { smsOptInConsent } : {}),
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
      notificationFlowPreferences: parseFlowPreferences(payload.notification_flow_preferences),
    });
    return jsonResponse(200, headers, {
      user: {
        ...addProfilePhotoReadUrl(result.user),
        ui_language: result.user.ui_language ?? null,
        ui_color_scheme: result.user.ui_color_scheme ?? null,
        portal_tour_completed: Boolean(result.user.portal_tour_completed),
      },
      notification_preferences: result.notificationPreferences,
      notification_flow_preferences: result.notificationFlowPreferences.map((p) => ({
        event_type_code: p.event_type_code,
        email_enabled: p.email_enabled,
        in_app_enabled: p.in_app_enabled,
        sms_enabled: p.sms_enabled,
      })),
      sms_consent: {
        phone_change_reset: result.phoneChangeInvalidatedSmsConsent,
      },
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
