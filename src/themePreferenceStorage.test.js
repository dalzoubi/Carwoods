import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearStoredColorScheme,
    readStoredColorScheme,
    STORAGE_KEY,
    writeStoredColorScheme,
} from './themePreferenceStorage';

describe('themePreferenceStorage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns null when unset', () => {
        expect(readStoredColorScheme()).toBeNull();
    });

    it('reads and writes light and dark', () => {
        writeStoredColorScheme('dark');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
        expect(readStoredColorScheme()).toBe('dark');
        writeStoredColorScheme('light');
        expect(readStoredColorScheme()).toBe('light');
    });

    it('clearStoredColorScheme removes key', () => {
        writeStoredColorScheme('light');
        clearStoredColorScheme();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(readStoredColorScheme()).toBeNull();
    });

    it('returns null for invalid stored value', () => {
        localStorage.setItem(STORAGE_KEY, 'bogus');
        expect(readStoredColorScheme()).toBeNull();
    });

    it('handles localStorage errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readStoredColorScheme()).toBeNull();
    });
});
