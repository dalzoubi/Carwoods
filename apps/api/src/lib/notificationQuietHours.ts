/**
 * Quiet-hours helpers for Phase 3 notifications.
 * Default: 8:00 PM – 6:00 AM in America/Chicago (Central).
 * Per-user override uses IANA timezone + start/end minute-of-day (0–1439).
 */

export const DEFAULT_QUIET_TIMEZONE = 'America/Chicago';
/** 20:00 local */
export const DEFAULT_QUIET_START_MINUTE = 20 * 60;
/** 06:00 local */
export const DEFAULT_QUIET_END_MINUTE = 6 * 60;

export type QuietHoursPreference = {
  timezone: string | null;
  startMinute: number | null;
  endMinute: number | null;
};

/** Minute-of-day for quiet hours must stay in [0, 1439] for comparisons to stay well-defined. */
export function clampQuietHoursMinuteOfDay(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 0 || n > 1439) return null;
  return n;
}

export function normalizeQuietHoursPreference(raw: {
  timezone?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
}): QuietHoursPreference {
  const tz = typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : null;
  return {
    timezone: tz,
    startMinute: clampQuietHoursMinuteOfDay(raw.startMinute ?? null),
    endMinute: clampQuietHoursMinuteOfDay(raw.endMinute ?? null),
  };
}

/**
 * Current minute-of-day (0–1439) in the given IANA time zone.
 */
export function getLocalMinuteOfDay(now: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Quiet window may span midnight when start > end (e.g. 20:00–06:00).
 */
export function isMinuteInQuietWindow(
  minuteOfDay: number,
  startMinute: number,
  endMinute: number
): boolean {
  const mod = clampQuietHoursMinuteOfDay(minuteOfDay);
  const start = clampQuietHoursMinuteOfDay(startMinute);
  const end = clampQuietHoursMinuteOfDay(endMinute);
  if (mod === null || start === null || end === null) return false;
  if (start === end) return false;
  if (start > end) {
    return mod >= start || mod < end;
  }
  return mod >= start && mod < end;
}

export function isQuietHoursNow(
  now: Date,
  pref: QuietHoursPreference,
  defaults: { timezone: string; startMinute: number; endMinute: number } = {
    timezone: DEFAULT_QUIET_TIMEZONE,
    startMinute: DEFAULT_QUIET_START_MINUTE,
    endMinute: DEFAULT_QUIET_END_MINUTE,
  }
): boolean {
  const tz = pref.timezone ?? defaults.timezone;
  const start = pref.startMinute ?? defaults.startMinute;
  const end = pref.endMinute ?? defaults.endMinute;
  const mod = getLocalMinuteOfDay(now, tz);
  return isMinuteInQuietWindow(mod, start, end);
}

/**
 * Next time (approximate hour steps) when quiet hours are not active for the preference.
 */
export function estimateResumeAfterQuietHours(now: Date, pref: QuietHoursPreference): Date {
  if (!isQuietHoursNow(now, pref)) return now;
  let t = new Date(now.getTime());
  for (let i = 0; i < 48; i += 1) {
    t = new Date(t.getTime() + 60 * 60 * 1000);
    if (!isQuietHoursNow(t, pref)) return t;
  }
  return new Date(now.getTime() + 48 * 60 * 60 * 1000);
}
