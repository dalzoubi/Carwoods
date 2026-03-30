import { useCallback, useEffect, useState } from 'react';

/** Must match `TocPageLayoutGrid` wide layout in styles.js (sticky TOC column). */
const TOC_SCROLL_SPY_MIN_WIDTH_PX = 1200;

function readStickyOffsetPx() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--sticky-nav-offset').trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 48;
}

function collectTocIds(tocRoot) {
    if (!tocRoot) return [];
    return Array.from(tocRoot.querySelectorAll('a[href^="#"]'))
        .map((a) => a.getAttribute('href').slice(1))
        .filter(Boolean);
}

function pickActiveId(ids) {
    if (ids.length === 0) return null;
    const offset = readStickyOffsetPx();
    const focusLine = window.scrollY + offset + 16;
    let best = ids[0];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= focusLine) best = id;
    }
    return best;
}

function syncLinkMarkers(tocRoot, activeId) {
    if (!tocRoot) return;
    tocRoot.querySelectorAll('a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href').slice(1);
        if (activeId && id === activeId) {
            a.classList.add('toc-scroll-spy-active');
            a.setAttribute('aria-current', 'location');
        } else {
            a.classList.remove('toc-scroll-spy-active');
            a.removeAttribute('aria-current');
        }
    });
}

/**
 * Highlights the TOC link for the section nearest the top of the viewport (below the sticky header).
 * @param {React.RefObject<HTMLElement | null>} tocNavRef - ref to the TOC nav element
 */
export function useTocScrollSpy(tocNavRef) {
    const [activeId, setActiveId] = useState(null);
    const [wideStickyTocLayout, setWideStickyTocLayout] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia(`(min-width: ${TOC_SCROLL_SPY_MIN_WIDTH_PX}px)`).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia(`(min-width: ${TOC_SCROLL_SPY_MIN_WIDTH_PX}px)`);
        const onChange = () => setWideStickyTocLayout(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    const updateActive = useCallback(() => {
        const root = tocNavRef.current;
        if (!root) return;
        if (!wideStickyTocLayout) {
            setActiveId(null);
            return;
        }
        const ids = collectTocIds(root);
        if (ids.length === 0) return;
        const next = pickActiveId(ids);
        setActiveId((prev) => (prev === next ? prev : next));
    }, [tocNavRef, wideStickyTocLayout]);

    useEffect(() => {
        const root = tocNavRef.current;
        if (!root) return undefined;

        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateActive);
        };

        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });
        schedule();

        const mo = new MutationObserver(schedule);
        mo.observe(root, { childList: true, subtree: true });

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            mo.disconnect();
        };
    }, [tocNavRef, updateActive]);

    useEffect(() => {
        syncLinkMarkers(tocNavRef.current, wideStickyTocLayout ? activeId : null);
    }, [activeId, wideStickyTocLayout, tocNavRef]);
}
