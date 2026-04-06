import React, { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import PortalSidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './PortalSidebar';
import PortalTopBar from './PortalTopBar';

const PortalLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { pathname } = useLocation();
  const sidebarWidth = isMobile ? SIDEBAR_WIDTH : (desktopSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <PortalSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isMobile={isMobile}
        collapsed={desktopSidebarCollapsed}
      />

      <Box
        component="main"
        id="main-content"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
          transition: (theme) => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <PortalTopBar
          onMenuClick={() => setMobileOpen(true)}
          isMobile={isMobile}
          isSidebarCollapsed={desktopSidebarCollapsed}
          onSidebarToggle={() => setDesktopSidebarCollapsed((prev) => !prev)}
        />

        <Box
          key={pathname}
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            maxWidth: 1080,
            width: '100%',
            boxSizing: 'border-box',
            mx: 'auto',
            '@keyframes portalPageIn': {
              from: { opacity: 0, transform: 'translateY(8px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            animation: 'portalPageIn 0.22s ease-out',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default PortalLayout;
