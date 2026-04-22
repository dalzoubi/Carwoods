import { useCallback, useEffect, useRef, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { fetchSidebarBadges } from '../lib/portalApiClient';
import { PORTAL_SIDEBAR_BADGES_REFRESH_EVENT } from '../lib/portalSidebarBadgesBridge.js';

const EMPTY = {
  requests: 0,
  notifications: 0,
  notices: 0,
  contact: 0,
  supportTickets: 0,
  supportTicketsAdmin: 0,
};
const POLL_MS = 60000;

/**
 * Polls the sidebar-badges endpoint and returns the current counts.
 * Fails silently — returns zeros on error so the UI doesn't break.
 */
export function useSidebarBadges() {
  const { isAuthenticated, baseUrl, meStatus, meData, account, getAccessToken } = usePortalAuth();
  const [badges, setBadges] = useState(EMPTY);
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!isAuthenticated || !baseUrl || meStatus === 'loading') return;
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchSidebarBadges(baseUrl, accessToken, { emailHint });
      if (!mountedRef.current) return;
      setBadges({
        requests: Number(payload?.requests ?? 0),
        notifications: Number(payload?.notifications ?? 0),
        notices: Number(payload?.notices ?? 0),
        contact: Number(payload?.contact ?? 0),
        supportTickets: Number(payload?.support_tickets ?? 0),
        supportTicketsAdmin: Number(payload?.support_tickets_admin ?? 0),
      });
    } catch {
      if (mountedRef.current) setBadges(EMPTY);
    }
  }, [isAuthenticated, baseUrl, meStatus, getAccessToken, emailHint]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    const onRefresh = () => void load();
    window.addEventListener(PORTAL_SIDEBAR_BADGES_REFRESH_EVENT, onRefresh);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      window.removeEventListener(PORTAL_SIDEBAR_BADGES_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  return badges;
}
