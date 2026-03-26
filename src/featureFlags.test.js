import { describe, expect, it } from 'vitest';
import { FEATURE_DARK_THEME } from './featureFlags';

describe('featureFlags', () => {
    it('FEATURE_DARK_THEME is false unless VITE_FEATURE_DARK_THEME is set in the build', () => {
        expect(FEATURE_DARK_THEME).toBe(
            import.meta.env.VITE_FEATURE_DARK_THEME === 'true'
        );
    });
});
