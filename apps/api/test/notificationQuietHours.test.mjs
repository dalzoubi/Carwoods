import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isQuietHoursNow,
  isMinuteInQuietWindow,
  getLocalMinuteOfDay,
  estimateResumeAfterQuietHours,
  clampQuietHoursMinuteOfDay,
} from '../dist/src/lib/notificationQuietHours.js';
import { computeNotificationRetryDelayMinutes } from '../dist/src/lib/notificationRepo.js';

test('isMinuteInQuietWindow handles overnight window', () => {
  assert.equal(isMinuteInQuietWindow(21 * 60, 20 * 60, 6 * 60), true);
  assert.equal(isMinuteInQuietWindow(5 * 60, 20 * 60, 6 * 60), true);
  assert.equal(isMinuteInQuietWindow(12 * 60, 20 * 60, 6 * 60), false);
});

test('isMinuteInQuietWindow rejects out-of-range minutes (no false quiet positives)', () => {
  assert.equal(isMinuteInQuietWindow(5 * 60, 2000, 6 * 60), false);
  assert.equal(isMinuteInQuietWindow(12 * 60, 20 * 60, 2000), false);
  assert.equal(isMinuteInQuietWindow(2000, 20 * 60, 6 * 60), false);
});

test('clampQuietHoursMinuteOfDay bounds to 0–1439', () => {
  assert.equal(clampQuietHoursMinuteOfDay(0), 0);
  assert.equal(clampQuietHoursMinuteOfDay(1439), 1439);
  assert.equal(clampQuietHoursMinuteOfDay(1440), null);
  assert.equal(clampQuietHoursMinuteOfDay(-1), null);
  assert.equal(clampQuietHoursMinuteOfDay(2000), null);
});

test('getLocalMinuteOfDay returns stable minute bucket for Chicago', () => {
  const d = new Date('2026-01-15T08:30:00.000Z');
  const mod = getLocalMinuteOfDay(d, 'America/Chicago');
  assert.ok(mod >= 0 && mod <= 1439);
});

test('estimateResumeAfterQuietHours advances out of quiet window', () => {
  const pref = { timezone: 'America/Chicago', startMinute: 20 * 60, endMinute: 6 * 60 };
  const now = new Date('2026-06-10T03:00:00.000Z');
  if (!isQuietHoursNow(now, pref)) {
    assert.equal(estimateResumeAfterQuietHours(now, pref).getTime(), now.getTime());
    return;
  }
  const resume = estimateResumeAfterQuietHours(now, pref);
  assert.ok(resume.getTime() > now.getTime());
  assert.equal(isQuietHoursNow(resume, pref), false);
});

test('computeNotificationRetryDelayMinutes doubles from base 5', () => {
  assert.equal(computeNotificationRetryDelayMinutes(0), 5);
  assert.equal(computeNotificationRetryDelayMinutes(1), 10);
  assert.equal(computeNotificationRetryDelayMinutes(2), 20);
});
