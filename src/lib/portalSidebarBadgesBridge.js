/** Fired after portal mutations so `useSidebarBadges` can refetch counts immediately. */
export const PORTAL_SIDEBAR_BADGES_REFRESH_EVENT = 'portal-sidebar-badges-refresh';

export function emitPortalSidebarBadgesRefresh() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PORTAL_SIDEBAR_BADGES_REFRESH_EVENT));
  }
}
