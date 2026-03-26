const DARK_SEGMENT = '/dark';

/**
 * True when the URL is the dark preview (any page under /dark).
 */
export function isDarkPreviewRoute(pathname) {
    return pathname === DARK_SEGMENT || pathname.startsWith(`${DARK_SEGMENT}/`);
}

/**
 * Prefixes an in-app path with /dark when the user is browsing the dark preview.
 * @param {string} pathname - current location.pathname
 * @param {string | import('react-router-dom').To} to - target for NavLink/Link
 */
/**
 * Strip /dark prefix for “exit preview” navigation.
 * @param {string} pathname
 */
export function stripDarkPreviewPrefix(pathname) {
    if (pathname === DARK_SEGMENT) return '/';
    if (pathname.startsWith(`${DARK_SEGMENT}/`)) {
        const rest = pathname.slice(DARK_SEGMENT.length);
        return rest.length ? rest : '/';
    }
    return pathname;
}

export function withDarkPath(pathname, to) {
    if (!isDarkPreviewRoute(pathname)) return to;
    if (typeof to === 'string') {
        if (to.startsWith('http') || to.startsWith('mailto:') || to.startsWith('tel:') || to.startsWith('#')) {
            return to;
        }
        if (to === DARK_SEGMENT || to.startsWith(`${DARK_SEGMENT}/`)) return to;
        if (to === '/') return DARK_SEGMENT;
        return `${DARK_SEGMENT}${to}`;
    }
    if (to && typeof to === 'object' && typeof to.pathname === 'string') {
        const p = to.pathname;
        if (p === DARK_SEGMENT || p.startsWith(`${DARK_SEGMENT}/`)) return to;
        const nextPath = p === '/' ? DARK_SEGMENT : `${DARK_SEGMENT}${p}`;
        return { ...to, pathname: nextPath };
    }
    return to;
}

