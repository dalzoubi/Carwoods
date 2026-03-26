import { describe, expect, it } from 'vitest';
import { FEATURE_DARK_THEME } from './featureFlags';

describe('featureFlags', () => {
    it('FEATURE_DARK_THEME matches VITE_FEATURE_DARK_THEME (default on unless false)', () => {
        expect(FEATURE_DARK_THEME).toBe(
            import.meta.env.VITE_FEATURE_DARK_THEME !== 'false'
        );
    });
});
