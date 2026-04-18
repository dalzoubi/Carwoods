/** When the global request detail modal mutates data, the list pane (separate hook) must refetch. */
export const PORTAL_REQUESTS_LIST_REFRESH_EVENT = 'portal-requests-list-refresh';

export function emitPortalRequestsListRefresh() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PORTAL_REQUESTS_LIST_REFRESH_EVENT));
  }
}
