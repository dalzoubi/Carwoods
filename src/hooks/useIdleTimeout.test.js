import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimeout } from './useIdleTimeout';

describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onWarn at (idleMs - warningMs) and onTimeout at idleMs', () => {
    const onWarn = vi.fn();
    const onTimeout = vi.fn();

    renderHook(() =>
      useIdleTimeout({
        enabled: true,
        idleMs: 10_000,
        warningMs: 2_000,
        onWarn,
        onTimeout,
      })
    );

    // Nothing should fire before the warning window.
    act(() => {
      vi.advanceTimersByTime(7_999);
    });
    expect(onWarn).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();

    // Crossing the warning threshold.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();

    // Crossing the timeout threshold.
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('resets both timers when user activity is observed', () => {
    const onWarn = vi.fn();
    const onTimeout = vi.fn();

    renderHook(() =>
      useIdleTimeout({
        enabled: true,
        idleMs: 10_000,
        warningMs: 2_000,
        onWarn,
        onTimeout,
      })
    );

    // Advance partway, then simulate activity.
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });

    // After reset, 8s should pass without firing warn.
    act(() => {
      vi.advanceTimersByTime(7_999);
    });
    expect(onWarn).not.toHaveBeenCalled();

    // Cross the new warning threshold.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const onWarn = vi.fn();
    const onTimeout = vi.fn();

    renderHook(() =>
      useIdleTimeout({
        enabled: false,
        idleMs: 10_000,
        warningMs: 2_000,
        onWarn,
        onTimeout,
      })
    );

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onWarn).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
