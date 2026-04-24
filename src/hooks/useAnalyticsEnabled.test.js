import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalyticsEnabled } from './useAnalyticsEnabled';
import { STORAGE_KEY } from '../analyticsOptOutStorage';

/**
 * Reset the DNT surfaces between tests. We use Object.defineProperty because
 * `navigator.doNotTrack` is a getter on the jsdom navigator and cannot be
 * assigned to with a plain `=`.
 */
function setDnt({ winDnt, navDnt, msNavDnt } = {}) {
    Object.defineProperty(window, 'doNotTrack', {
        configurable: true,
        get: () => winDnt ?? null,
    });
    Object.defineProperty(window.navigator, 'doNotTrack', {
        configurable: true,
        get: () => navDnt ?? null,
    });
    Object.defineProperty(window.navigator, 'msDoNotTrack', {
        configurable: true,
        get: () => msNavDnt ?? null,
    });
}

describe('useAnalyticsEnabled', () => {
    beforeEach(() => {
        localStorage.clear();
        setDnt({});
    });

    afterEach(() => {
        localStorage.clear();
        setDnt({});
    });

    it('defaults to enabled when no preference is stored and DNT is off', () => {
        const { result } = renderHook(() => useAnalyticsEnabled());
        expect(result.current.enabled).toBe(true);
        expect(result.current.optOut).toBe(false);
        expect(result.current.dntActive).toBe(false);
    });

    it('disables analytics when the user opts out via setOptOut', () => {
        const { result } = renderHook(() => useAnalyticsEnabled());
        act(() => {
            result.current.setOptOut(true);
        });
        expect(result.current.optOut).toBe(true);
        expect(result.current.enabled).toBe(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    });

    it('disables analytics when navigator.doNotTrack is "1" regardless of stored preference', () => {
        setDnt({ navDnt: '1' });
        const { result } = renderHook(() => useAnalyticsEnabled());
        expect(result.current.dntActive).toBe(true);
        expect(result.current.enabled).toBe(false);
    });

    it('disables analytics when window.doNotTrack is "1"', () => {
        setDnt({ winDnt: '1' });
        const { result } = renderHook(() => useAnalyticsEnabled());
        expect(result.current.dntActive).toBe(true);
        expect(result.current.enabled).toBe(false);
    });

    it('keeps the stored preference editable while DNT is active; DNT still wins for `enabled`', () => {
        setDnt({ navDnt: '1' });
        localStorage.setItem(STORAGE_KEY, 'true');
        const { result } = renderHook(() => useAnalyticsEnabled());
        expect(result.current.dntActive).toBe(true);
        expect(result.current.optOut).toBe(true);
        expect(result.current.enabled).toBe(false);

        act(() => {
            result.current.setOptOut(false);
        });
        // The stored preference flipped to opted-in...
        expect(result.current.optOut).toBe(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
        // ...but DNT still forces analytics off.
        expect(result.current.enabled).toBe(false);
    });
});
