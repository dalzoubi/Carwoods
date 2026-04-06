import React, { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import PortalSidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './PortalSidebar';
import PortalTopBar from './PortalTopBar';

const PortalLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarWidth = isMobile ? SIDEBAR_WIDTH : (desktopSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <PortalSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isMobile={isMobile}
        collapsed={desktopSidebarCollapsed}
        onSidebarToggle={() => setDesktopSidebarCollapsed((prev) => !prev)}
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
        }}
      >
        <PortalTopBar
          onMenuClick={() => setMobileOpen(true)}
          isMobile={isMobile}
        />

        <Box
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            maxWidth: 1080,
            width: '100%',
            boxSizing: 'border-box',
            mx: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default PortalLayout;
