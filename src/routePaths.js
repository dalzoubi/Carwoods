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

/** Routes that show the header print control (see ResponsiveNavbar). */
const PRINTABLE_PAGE_PATHS = new Set([
    '/tenant-selection-criteria',
    '/application-required-documents',
    '/property-management',
    '/self-managed-landlords',
]);

/**
 * True when the current route should show the print button in the site header.
 * @param {string} pathname - `location.pathname` (may include `/dark` preview prefix).
 */
export function isPrintablePageRoute(pathname) {
    return PRINTABLE_PAGE_PATHS.has(stripDarkPreviewPrefix(pathname));
}

/**
 * True when the current location is a portal route (with or without /dark prefix).
 * @param {string} pathname
 */
export function isPortalRoute(pathname) {
    const normalized = stripDarkPreviewPrefix(pathname);
    return normalized === '/portal' || normalized.startsWith('/portal/');
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

