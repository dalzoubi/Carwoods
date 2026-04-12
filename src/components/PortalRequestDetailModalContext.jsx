import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import PortalRequestDetailGlobalModal from './PortalRequestDetailGlobalModal';

export const PortalRequestDetailModalContext = createContext(null);

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
    };
  }
  return ctx;
}

export function PortalRequestDetailModalProvider({ children }) {
  const [overlayRequestId, setOverlayRequestId] = useState('');

  const openRequestDetail = useCallback((id) => {
    const sid = String(id || '').trim();
    if (sid) setOverlayRequestId(sid);
  }, []);

  const closeRequestDetail = useCallback(() => {
    setOverlayRequestId('');
  }, []);

  const value = useMemo(
    () => ({
      isAvailable: true,
      openRequestDetail,
      closeRequestDetail,
      overlayRequestId,
    }),
    [openRequestDetail, closeRequestDetail, overlayRequestId]
  );

  return (
    <PortalRequestDetailModalContext.Provider value={value}>
      {children}
      <PortalRequestDetailGlobalModal />
    </PortalRequestDetailModalContext.Provider>
  );
}
