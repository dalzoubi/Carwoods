import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearStoredLanguage,
    readStoredLanguage,
    writeStoredLanguage,
} from './languagePreferenceStorage';

const STORAGE_KEY = 'carwoods-language';

describe('languagePreferenceStorage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns null when unset', () => {
        expect(readStoredLanguage()).toBeNull();
    });

    it('writes and reads a language code', () => {
        writeStoredLanguage('es');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('es');
        expect(readStoredLanguage()).toBe('es');
    });

    it('overwrites with a new language', () => {
        writeStoredLanguage('fr');
        writeStoredLanguage('ar');
        expect(readStoredLanguage()).toBe('ar');
    });

    it('clearStoredLanguage removes the key', () => {
        writeStoredLanguage('ar');
        clearStoredLanguage();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(readStoredLanguage()).toBeNull();
    });

    it('handles localStorage read errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readStoredLanguage()).toBeNull();
    });

    it('handles localStorage write errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => writeStoredLanguage('es')).not.toThrow();
    });

    it('handles localStorage remove errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => clearStoredLanguage()).not.toThrow();
    });
});
