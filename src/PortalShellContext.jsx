import React, { createContext, useContext } from 'react';

const PortalShellContext = createContext({
  isMobile: false,
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
});

export function PortalShellProvider({ isMobile, openMobileSidebar, closeMobileSidebar, children }) {
  const value = React.useMemo(
    () => ({ isMobile, openMobileSidebar, closeMobileSidebar }),
    [isMobile, openMobileSidebar, closeMobileSidebar]
  );
  return <PortalShellContext.Provider value={value}>{children}</PortalShellContext.Provider>;
}

export function usePortalShell() {
  return useContext(PortalShellContext);
}
