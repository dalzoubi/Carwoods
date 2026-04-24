import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toDatePart, getLeaseDisplayPhase } from './leaseDisplayPhase.js';

/** Frozen "today" in module logic is `new Date().toISOString().slice(0, 10)` (UTC). */
const T = '2025-06-15';

describe('toDatePart', () => {
  it('returns empty for nullish', () => {
    expect(toDatePart(null)).toBe('');
    expect(toDatePart(undefined)).toBe('');
    expect(toDatePart('')).toBe('');
  });

  it('keeps YYYY-MM-DD and slices ISO datetimes to date part', () => {
    expect(toDatePart('2024-03-01')).toBe('2024-03-01');
    expect(toDatePart('2024-03-01T00:00:00.000Z')).toBe('2024-03-01');
  });
});

describe('getLeaseDisplayPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${T}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats missing or empty start as active', () => {
    expect(getLeaseDisplayPhase(null)).toBe('active');
    expect(getLeaseDisplayPhase({})).toBe('active');
  });

  it('returns future when start is after today (UTC date)', () => {
    expect(
      getLeaseDisplayPhase({ start_date: '2025-12-01', end_date: '2026-12-31', month_to_month: false })
    ).toBe('future');
  });

  it('returns expired when fixed term ended before today', () => {
    expect(
      getLeaseDisplayPhase({ start_date: '2023-01-01', end_date: '2025-05-31', month_to_month: false })
    ).toBe('expired');
  });

  it('returns active for month-to-month even if end_date is in the past', () => {
    expect(
      getLeaseDisplayPhase({ start_date: '2020-01-01', end_date: '2020-12-31', month_to_month: true })
    ).toBe('active');
  });

  it('returns active when no end date (open-ended fixed start)', () => {
    expect(
      getLeaseDisplayPhase({ start_date: '2024-01-01', end_date: null, month_to_month: false })
    ).toBe('active');
  });

  it('returns active when start is in the past and end is on or after today', () => {
    expect(
      getLeaseDisplayPhase({ start_date: '2024-01-01', end_date: '2026-12-31', month_to_month: false })
    ).toBe('active');
  });
});
