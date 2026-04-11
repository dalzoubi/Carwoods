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

  try {
    const result = await updateProfile(getPool(), {
      actorUserId: user.id,
      email: str(payload.email),
      firstName: str(payload.first_name) ?? null,
      lastName: str(payload.last_name) ?? null,
      phone: str(payload.phone) ?? null,
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
      user: addProfilePhotoReadUrl(result.user),
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
