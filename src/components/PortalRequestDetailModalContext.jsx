import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import PortalRequestDetailGlobalModal from './PortalRequestDetailGlobalModal';

export const PortalRequestDetailModalContext = createContext(null);

function normalizeHighlight(highlight) {
  if (!highlight || typeof highlight !== 'object') return null;
  const out = {};
  const m = String(highlight.messageId || '').trim();
  const a = String(highlight.attachmentId || '').trim();
  const d = String(highlight.decisionId || '').trim();
  if (m) out.messageId = m;
  if (a) out.attachmentId = a;
  if (d) out.decisionId = d;
  return Object.keys(out).length ? out : null;
}

/**
 * Opens the portal-wide maintenance request detail dialog without changing the route.
 * Outside {@link PortalRequestDetailModalProvider}, `openRequestDetail` is a no-op and `isAvailable` is false.
 */
export function usePortalRequestDetailModal() {
  const ctx = useContext(PortalRequestDetailModalContext);
  if (!ctx) {
    return {
      isAvailable: false,
      openRequestDetail: () => {},
      closeRequestDetail: () => {},
      overlayRequestId: '',
      overlayHighlight: null,
    };
  }
  return ctx;
}

export function PortalRequestDetailModalProvider({ children }) {
  const [overlayRequestId, setOverlayRequestId] = useState('');
  const [overlayHighlight, setOverlayHighlight] = useState(null);

  const openRequestDetail = useCallback((id, highlight = null) => {
    const sid = String(id || '').trim();
    if (!sid) return;
    setOverlayRequestId(sid);
    setOverlayHighlight(normalizeHighlight(highlight));
  }, []);

  const closeRequestDetail = useCallback(() => {
    setOverlayRequestId('');
    setOverlayHighlight(null);
  }, []);

  const value = useMemo(
    () => ({
      isAvailable: true,
      openRequestDetail,
      closeRequestDetail,
      overlayRequestId,
      overlayHighlight,
    }),
    [openRequestDetail, closeRequestDetail, overlayRequestId, overlayHighlight]
  );

  return (
    <PortalRequestDetailModalContext.Provider value={value}>
      {children}
      <PortalRequestDetailGlobalModal />
    </PortalRequestDetailModalContext.Provider>
  );
}
