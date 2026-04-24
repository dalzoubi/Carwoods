import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearAnalyticsOptOut,
    getAnalyticsOptOut,
    setAnalyticsOptOut,
    STORAGE_KEY,
} from './analyticsOptOutStorage';

describe('analyticsOptOutStorage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns false by default when no preference is stored', () => {
        expect(getAnalyticsOptOut()).toBe(false);
    });

    it('persists opt-out true and reads it back', () => {
        setAnalyticsOptOut(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
        expect(getAnalyticsOptOut()).toBe(true);
    });

    it('persists opt-out false and reads it back', () => {
        setAnalyticsOptOut(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
        expect(getAnalyticsOptOut()).toBe(false);
    });

    it('clearAnalyticsOptOut removes the stored value', () => {
        setAnalyticsOptOut(true);
        clearAnalyticsOptOut();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(getAnalyticsOptOut()).toBe(false);
    });

    it('returns false when localStorage access throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(getAnalyticsOptOut()).toBe(false);
    });
});
