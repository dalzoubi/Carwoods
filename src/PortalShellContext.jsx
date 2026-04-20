import React, { createContext, useContext } from 'react';

const PortalShellContext = createContext({
  isMobile: false,
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
  /** Widen the desktop sidebar so nav tour targets have stable rects (collapsible rail). */
  expandDesktopSidebar: () => {},
});

export function PortalShellProvider({
  isMobile,
  openMobileSidebar,
  closeMobileSidebar,
  expandDesktopSidebar,
  children,
}) {
  const value = React.useMemo(
    () => ({ isMobile, openMobileSidebar, closeMobileSidebar, expandDesktopSidebar }),
    [isMobile, openMobileSidebar, closeMobileSidebar, expandDesktopSidebar]
  );
  return <PortalShellContext.Provider value={value}>{children}</PortalShellContext.Provider>;
}

export function usePortalShell() {
  return useContext(PortalShellContext);
}
