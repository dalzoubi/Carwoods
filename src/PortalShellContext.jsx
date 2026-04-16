import React, { createContext, useContext } from 'react';

const PortalShellContext = createContext({
  isMobile: false,
  openMobileSidebar: () => {},
});

export function PortalShellProvider({ isMobile, openMobileSidebar, children }) {
  const value = React.useMemo(
    () => ({ isMobile, openMobileSidebar }),
    [isMobile, openMobileSidebar]
  );
  return <PortalShellContext.Provider value={value}>{children}</PortalShellContext.Provider>;
}

export function usePortalShell() {
  return useContext(PortalShellContext);
}
