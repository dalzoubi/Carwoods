import { useEffect, useRef, useState } from 'react';

/**
 * useHighlightRow — coordinates the "deep-link into a row and highlight it"
 * pattern shared by admin lists.
 *
 * Beyond scrolling the row into view, it:
 *   - sets aria-current on the row for screen readers
 *   - moves focus to the row so keyboard users don't lose their place
 *   - exposes a polite announcement string for an aria-live region
 *
 * Usage:
 *   const { flashId, ariaAnnouncement, getRowProps, clear } = useHighlightRow({
 *     targetId,            // id to highlight, or falsy to do nothing
 *     elementIdFor: (id) => `landlord-row-${id}`,
 *     announcement,        // string read out by screen readers when row lands
 *     durationMs: 4000,    // auto-clear timer (0 = manual clear only)
 *     ready: true,         // gate until list has loaded
 *   });
 *
 *   // On the row element:
 *   <div id={elementIdFor(row.id)} {...getRowProps(row.id)}>
 */
export default function useHighlightRow({
  targetId,
  elementIdFor,
  announcement = '',
  durationMs = 4000,
  ready = true,
  onScrolled,
} = {}) {
  const [flashId, setFlashId] = useState(null);
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!ready) return undefined;
    if (!targetId) return undefined;
    const id = String(targetId);

    const frame = window.requestAnimationFrame(() => {
      const el = typeof elementIdFor === 'function'
        ? document.getElementById(elementIdFor(id))
        : null;
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        el.scrollIntoView();
      }
      if (typeof el.focus === 'function') {
        if (!el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '-1');
        }
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
      }
      if (typeof onScrolled === 'function') {
        onScrolled(id, el);
      }
    });

    setFlashId(id);
    if (announcement) setMessage(announcement);

    if (durationMs > 0) {
      timerRef.current = window.setTimeout(() => {
        setFlashId(null);
        setMessage('');
      }, durationMs);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, ready]);

  const clear = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFlashId(null);
    setMessage('');
  };

  const getRowProps = (rowId) => {
    const isActive = flashId != null && String(rowId) === flashId;
    return isActive
      ? { 'aria-current': 'true', tabIndex: -1 }
      : {};
  };

  return { flashId, ariaAnnouncement: message, getRowProps, clear };
}
