import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE_EVENTS } from '../sessionConfig';

/**
 * Fires an onWarn callback after (idleMs - warningMs) of user inactivity,
 * then an onTimeout callback at idleMs. User activity (pointer, key, touch,
 * tab visible again) resets both timers.
 *
 * @param {object} params
 * @param {boolean} params.enabled  When false, listeners + timers are off.
 * @param {number} params.idleMs    Total idle budget before timeout fires.
 * @param {number} params.warningMs Warning window inside idleMs (must be < idleMs).
 * @param {() => void} [params.onWarn]     Called when the warning window starts.
 * @param {() => void} [params.onTimeout]  Called when the idle budget expires.
 * @param {() => void} [params.onActivity] Called on each user activity event (throttled by React state).
 * @returns {{ extend: () => void, reset: () => void, isWarning: boolean }}
 */
export function useIdleTimeout({
  enabled,
  idleMs,
  warningMs,
  onWarn,
  onTimeout,
  onActivity,
}) {
  const [isWarning, setIsWarning] = useState(false);
  const warnTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);

  const onWarnRef = useRef(onWarn);
  const onTimeoutRef = useRef(onTimeout);
  const onActivityRef = useRef(onActivity);
  onWarnRef.current = onWarn;
  onTimeoutRef.current = onTimeout;
  onActivityRef.current = onActivity;

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current != null) {
      clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
    if (timeoutTimerRef.current != null) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    const warnDelay = Math.max(0, idleMs - warningMs);
    warnTimerRef.current = setTimeout(() => {
      setIsWarning(true);
      if (typeof onWarnRef.current === 'function') onWarnRef.current();
    }, warnDelay);
    timeoutTimerRef.current = setTimeout(() => {
      setIsWarning(false);
      if (typeof onTimeoutRef.current === 'function') onTimeoutRef.current();
    }, idleMs);
  }, [clearTimers, idleMs, warningMs]);

  const reset = useCallback(() => {
    setIsWarning(false);
    scheduleTimers();
  }, [scheduleTimers]);

  const extend = useCallback(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    scheduleTimers();

    const handleActivity = (event) => {
      // For visibilitychange, only treat "tab became visible" as activity.
      if (event && event.type === 'visibilitychange') {
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      }
      setIsWarning(false);
      scheduleTimers();
      if (typeof onActivityRef.current === 'function') onActivityRef.current();
    };

    for (const eventName of IDLE_EVENTS) {
      const target = eventName === 'visibilitychange' ? document : window;
      target.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const eventName of IDLE_EVENTS) {
        const target = eventName === 'visibilitychange' ? document : window;
        target.removeEventListener(eventName, handleActivity);
      }
    };
  }, [enabled, scheduleTimers, clearTimers]);

  return { extend, reset, isWarning };
}
