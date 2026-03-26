import { describe, expect, it } from 'vitest';
import { isDarkPreviewRoute, stripDarkPreviewPrefix, withDarkPath } from './routePaths';

describe('routePaths', () => {
    it('isDarkPreviewRoute', () => {
        expect(isDarkPreviewRoute('/')).toBe(false);
        expect(isDarkPreviewRoute('/apply')).toBe(false);
        expect(isDarkPreviewRoute('/dark')).toBe(true);
        expect(isDarkPreviewRoute('/dark/apply')).toBe(true);
    });

    it('withDarkPath leaves paths unchanged outside preview', () => {
        expect(withDarkPath('/apply', '/contact-us')).toBe('/contact-us');
    });

    it('withDarkPath prefixes in preview', () => {
        expect(withDarkPath('/dark', '/')).toBe('/dark');
        expect(withDarkPath('/dark', '/apply')).toBe('/dark/apply');
        expect(withDarkPath('/dark/apply', '/')).toBe('/dark');
        expect(withDarkPath('/dark', '/dark')).toBe('/dark');
    });

    it('stripDarkPreviewPrefix', () => {
        expect(stripDarkPreviewPrefix('/dark')).toBe('/');
        expect(stripDarkPreviewPrefix('/dark/apply')).toBe('/apply');
        expect(stripDarkPreviewPrefix('/apply')).toBe('/apply');
    });
});
