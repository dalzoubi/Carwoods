import { describe, expect, it } from 'vitest';
import {
    FEATURE_DARK_THEME,
    MESSAGES_POLL_INTERVAL_MS,
    NOTIFICATIONS_POLL_INTERVAL_MS,
    notificationsPollIntervalMs,
} from './featureFlags';

describe('featureFlags', () => {
    it('FEATURE_DARK_THEME matches VITE_FEATURE_DARK_THEME (default on unless false)', () => {
        expect(FEATURE_DARK_THEME).toBe(
            import.meta.env.VITE_FEATURE_DARK_THEME !== 'false'
        );
    });

    it('MESSAGES_POLL_INTERVAL_MS is within [10s, 5m]', () => {
        expect(MESSAGES_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(10 * 1000);
        expect(MESSAGES_POLL_INTERVAL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('notificationsPollIntervalMs uses base interval when tray closed', () => {
        expect(notificationsPollIntervalMs(false)).toBe(NOTIFICATIONS_POLL_INTERVAL_MS);
    });

    it('notificationsPollIntervalMs caps at 8s when tray open and base is slower', () => {
        expect(notificationsPollIntervalMs(true)).toBe(
            Math.min(NOTIFICATIONS_POLL_INTERVAL_MS, 8 * 1000)
        );
    });
});
