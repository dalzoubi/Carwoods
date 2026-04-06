import React, { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { keyframes } from '@emotion/react';
import { useLocation } from 'react-router-dom';
import PortalSidebar from './PortalSidebar';
import PortalTopBar from './PortalTopBar';

const portalPageIn = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const PortalLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { pathname } = useLocation();

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
          minWidth: 0,
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
            animation: `${portalPageIn} 0.22s ease-out`,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default PortalLayout;
