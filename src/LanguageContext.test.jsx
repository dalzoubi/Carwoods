import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import i18nInstance, { SUPPORTED_LANGUAGES, getDirection } from './i18n';
import { LanguageProvider, useLanguage } from './LanguageContext';

// Helper: render with required providers
function renderWithProviders(ui) {
    return render(
        <BrowserRouter>
            <LanguageProvider>{ui}</LanguageProvider>
        </BrowserRouter>
    );
}

// Simple consumer that exposes context values via data attributes
function LanguageConsumer() {
    const { currentLanguage, direction, isRTL, storedLanguageOverride } = useLanguage();
    return (
        <div
            data-testid="consumer"
            data-lang={currentLanguage}
            data-dir={direction}
            data-rtl={String(isRTL)}
            data-override={storedLanguageOverride ?? ''}
        />
    );
}

describe('getDirection', () => {
    it('returns rtl for Arabic', () => {
        expect(getDirection('ar')).toBe('rtl');
    });

    it('returns ltr for English', () => {
        expect(getDirection('en')).toBe('ltr');
    });

    it('returns ltr for Spanish', () => {
        expect(getDirection('es')).toBe('ltr');
    });

    it('returns ltr for French', () => {
        expect(getDirection('fr')).toBe('ltr');
    });
});

describe('SUPPORTED_LANGUAGES', () => {
    it('includes en, es, fr, ar', () => {
        expect(SUPPORTED_LANGUAGES).toContain('en');
        expect(SUPPORTED_LANGUAGES).toContain('es');
        expect(SUPPORTED_LANGUAGES).toContain('fr');
        expect(SUPPORTED_LANGUAGES).toContain('ar');
    });
});

describe('LanguageProvider', () => {
    beforeEach(async () => {
        localStorage.clear();
        await i18nInstance.changeLanguage('en');
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        // Reset html dir attribute
        document.documentElement.removeAttribute('dir');
        document.documentElement.removeAttribute('lang');
    });

    it('defaults to English LTR', () => {
        renderWithProviders(<LanguageConsumer />);
        const el = screen.getByTestId('consumer');
        expect(el.dataset.lang).toBe('en');
        expect(el.dataset.dir).toBe('ltr');
        expect(el.dataset.rtl).toBe('false');
    });

    it('sets html dir and lang attributes', () => {
        renderWithProviders(<LanguageConsumer />);
        expect(document.documentElement.getAttribute('dir')).toBe('ltr');
        expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('changeLanguage switches to Arabic RTL', async () => {
        function SwitcherConsumer() {
            const { currentLanguage, direction, isRTL, changeLanguage } = useLanguage();
            return (
                <>
                    <button onClick={() => changeLanguage('ar')}>Switch to Arabic</button>
                    <div
                        data-testid="consumer"
                        data-lang={currentLanguage}
                        data-dir={direction}
                        data-rtl={String(isRTL)}
                    />
                </>
            );
        }

        renderWithProviders(<SwitcherConsumer />);
        await act(async () => {
            screen.getByText('Switch to Arabic').click();
        });

        const el = screen.getByTestId('consumer');
        expect(el.dataset.lang).toBe('ar');
        expect(el.dataset.dir).toBe('rtl');
        expect(el.dataset.rtl).toBe('true');
        expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('changeLanguage switches to Spanish LTR', async () => {
        function SwitcherConsumer() {
            const { currentLanguage, changeLanguage } = useLanguage();
            return (
                <>
                    <button onClick={() => changeLanguage('es')}>Switch to Spanish</button>
                    <div data-testid="consumer" data-lang={currentLanguage} />
                </>
            );
        }

        renderWithProviders(<SwitcherConsumer />);
        await act(async () => {
            screen.getByText('Switch to Spanish').click();
        });

        expect(screen.getByTestId('consumer').dataset.lang).toBe('es');
    });

    it('ignores unsupported language codes', async () => {
        // Ensure no stored language from previous tests
        localStorage.clear();

        function SwitcherConsumer() {
            const { currentLanguage, changeLanguage } = useLanguage();
            return (
                <>
                    <button onClick={() => changeLanguage('xx')}>Switch to invalid</button>
                    <div data-testid="consumer" data-lang={currentLanguage} />
                </>
            );
        }

        renderWithProviders(<SwitcherConsumer />);
        const initialLang = screen.getByTestId('consumer').dataset.lang;
        await act(async () => {
            screen.getByText('Switch to invalid').click();
        });

        // Language should remain unchanged
        expect(screen.getByTestId('consumer').dataset.lang).toBe(initialLang);
    });

    it('persists explicit choice in localStorage', async () => {
        function SwitcherConsumer() {
            const { changeLanguage } = useLanguage();
            return <button onClick={() => changeLanguage('fr')}>Pick French</button>;
        }

        renderWithProviders(<SwitcherConsumer />);
        await act(async () => {
            screen.getByText('Pick French').click();
        });
        expect(localStorage.getItem('carwoods-language')).toBe('fr');
    });

    it('resetLanguagePreference clears storage and follows browser language', async () => {
        const nav = { language: 'es', languages: ['es-MX', 'en'] };
        vi.stubGlobal('navigator', nav);

        function ResetConsumer() {
            const { currentLanguage, changeLanguage, resetLanguagePreference, storedLanguageOverride } =
                useLanguage();
            return (
                <>
                    <button onClick={() => changeLanguage('fr')}>Pick French</button>
                    <button onClick={() => void resetLanguagePreference()}>Reset</button>
                    <div
                        data-testid="consumer"
                        data-lang={currentLanguage}
                        data-override={storedLanguageOverride ?? ''}
                    />
                </>
            );
        }

        renderWithProviders(<ResetConsumer />);
        await act(async () => {
            screen.getByText('Pick French').click();
        });
        expect(screen.getByTestId('consumer').dataset.override).toBe('fr');

        await act(async () => {
            screen.getByText('Reset').click();
        });
        expect(localStorage.getItem('carwoods-language')).toBeNull();
        expect(screen.getByTestId('consumer').dataset.lang).toBe('es');
        expect(screen.getByTestId('consumer').dataset.override).toBe('');

        vi.unstubAllGlobals();
    });

    it('throws if used outside LanguageProvider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        function BadConsumer() {
            useLanguage();
            return null;
        }
        expect(() =>
            render(
                <BrowserRouter>
                    <BadConsumer />
                </BrowserRouter>
            )
        ).toThrow('useLanguage must be used within LanguageProvider');
        consoleSpy.mockRestore();
    });
});
