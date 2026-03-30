import React, { useState } from 'react';
import {
    AppBar,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    Menu,
    MenuItem,
    useTheme,
    useMediaQuery,
    Divider,
    Typography,
    Box,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import RestartAlt from '@mui/icons-material/RestartAlt';
import { NavLink } from '../styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeMode } from '../ThemeModeContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import { stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import carwoodsLogo from '../assets/carwoods-logo.png';

const DRAWER_PAPER_ID = 'main-navigation-drawer';

const tenantLinks = [
    { to: '/apply', label: 'Apply' },
    { to: '/tenant-selection-criteria', label: 'Selection Criteria' },
    { to: '/application-required-documents', label: 'Required Documents' },
];

const landlordLinks = [
    { to: '/property-management', label: 'Property Management' },
];

const legalLinks = [
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/accessibility', label: 'Accessibility' },
];

const ResponsiveNavbar = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tenantAnchor, setTenantAnchor] = useState(null);
    const [landlordAnchor, setLandlordAnchor] = useState(null);
    const [appearanceAnchor, setAppearanceAnchor] = useState(null);
    const [appearanceMenuLabelledBy, setAppearanceMenuLabelledBy] = useState(undefined);
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
    const {
        storedOverride,
        darkThemeFeatureEnabled,
        isDarkPreviewPath,
        setOverrideLight,
        setOverrideDark,
        resetOverride,
    } = useThemeMode();
    const showAppearanceMenu = darkThemeFeatureEnabled || isDarkPreviewPath;

    const handleDrawerToggle = () => {
        setDrawerOpen(!drawerOpen);
    };

    const handleTenantOpen = (e) => {
        setLandlordAnchor(null);
        setAppearanceAnchor(null);
        setTenantAnchor(e.currentTarget);
    };
    const handleTenantClose = () => {
        setTenantAnchor(null);
    };
    const handleLandlordOpen = (e) => {
        setTenantAnchor(null);
        setAppearanceAnchor(null);
        setLandlordAnchor(e.currentTarget);
    };
    const handleLandlordClose = () => {
        setLandlordAnchor(null);
    };
    const handleAppearanceOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setAppearanceAnchor(e.currentTarget);
        const trigger = e.currentTarget.getAttribute('data-appearance-trigger');
        setAppearanceMenuLabelledBy(
            trigger === 'drawer' ? 'appearance-menu-button-drawer' : 'appearance-menu-button-toolbar'
        );
    };
    const handleAppearanceClose = () => {
        setAppearanceAnchor(null);
        setAppearanceMenuLabelledBy(undefined);
    };

    const listItemButtonSx = {
        '&:hover': {
            backgroundColor: muiTheme.palette.drawer.hover,
        },
        '&.active': {
            backgroundColor: 'var(--nav-chrome-active-bg)',
        },
    };

    const subheaderSx = {
        bgcolor: 'transparent',
        color: muiTheme.palette.drawer.text,
        pl: 2,
        pt: 1,
        pb: 0,
        fontSize: '0.875rem',
        fontWeight: 600,
        opacity: 0.9,
        lineHeight: 1.5,
    };

    const drawerContent = (
        <div style={{ backgroundColor: muiTheme.palette.drawer.background, height: '100%' }}>
            <nav aria-label="main navigation">
                <List disablePadding>
                    <ListItemButton
                        component={NavLink}
                        to={withDarkPath(pathname, '/')}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary="Home" style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        Tenant
                    </ListSubheader>
                    {tenantLinks.map(({ to, label }) => (
                        <ListItemButton
                            key={to}
                            component={NavLink}
                            to={withDarkPath(pathname, to)}
                            className={({ isActive }) => (isActive ? 'active' : '')}
                            onClick={handleDrawerToggle}
                            sx={{
                                pl: 3,
                                ...listItemButtonSx,
                            }}
                        >
                            <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ))}

                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        Landlord
                    </ListSubheader>
                    {landlordLinks.map(({ to, label }) => (
                        <ListItemButton
                            key={to}
                            component={NavLink}
                            to={withDarkPath(pathname, to)}
                            className={({ isActive }) => (isActive ? 'active' : '')}
                            onClick={handleDrawerToggle}
                            sx={{
                                pl: 3,
                                ...listItemButtonSx,
                            }}
                        >
                            <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ))}

                    <ListItemButton
                        component={NavLink}
                        to={withDarkPath(pathname, '/contact-us')}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary="Contact Us" style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    {showAppearanceMenu ? (
                        <ListItemButton
                            onClick={handleAppearanceOpen}
                            aria-haspopup="true"
                            aria-expanded={Boolean(appearanceAnchor)}
                            aria-controls={appearanceAnchor ? 'appearance-menu' : undefined}
                            id="appearance-menu-button-drawer"
                            data-appearance-trigger="drawer"
                            sx={{
                                ...listItemButtonSx,
                                '&:hover': {
                                    backgroundColor: muiTheme.palette.drawer.hover,
                                },
                            }}
                        >
                            <SettingsBrightness sx={{ mr: 1.5, color: muiTheme.palette.drawer.text }} fontSize="small" />
                            <ListItemText primary="Appearance" style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ) : null}

                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        Legal
                    </ListSubheader>
                    {legalLinks.map(({ to, label }) => (
                        <ListItemButton
                            key={to}
                            component={NavLink}
                            to={withDarkPath(pathname, to)}
                            className={({ isActive }) => (isActive ? 'active' : '')}
                            onClick={handleDrawerToggle}
                            sx={{
                                pl: 3,
                                ...listItemButtonSx,
                            }}
                        >
                            <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ))}
                </List>
            </nav>
        </div>
    );

    const desktopLegalLinkStyle = {
        fontSize: '0.8125rem',
        fontWeight: 600,
        opacity: 0.92,
        padding: '0.35rem 0.5rem',
    };

    return (
        <>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    top: 0,
                    zIndex: (t) => t.zIndex.appBar,
                    width: '100%',
                    backgroundColor: muiTheme.palette.appChrome.main,
                    backgroundImage: 'none',
                }}
            >
                <Toolbar
                    sx={{
                        flexWrap: 'wrap',
                        rowGap: 0.5,
                        columnGap: 0.5,
                    }}
                >
                    {isMobile ? (
                        <>
                            <IconButton
                                edge="start"
                                color="inherit"
                                type="button"
                                aria-label="open menu"
                                aria-haspopup="dialog"
                                aria-expanded={drawerOpen}
                                aria-controls={drawerOpen ? DRAWER_PAPER_ID : undefined}
                                onClick={handleDrawerToggle}
                            >
                                <MenuIcon />
                            </IconButton>
                            <NavLink to={withDarkPath(pathname, '/')} style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                                <img src={carwoodsLogo} alt="Carwoods" style={{ height: '40px' }} />
                            </NavLink>
                            {showAppearanceMenu ? (
                                <IconButton
                                    edge="end"
                                    color="inherit"
                                    type="button"
                                    id="appearance-menu-button-toolbar"
                                    data-appearance-trigger="toolbar"
                                    aria-label="Appearance and theme"
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(appearanceAnchor)}
                                    aria-controls={appearanceAnchor ? 'appearance-menu' : undefined}
                                    onClick={handleAppearanceOpen}
                                >
                                    <SettingsBrightness />
                                </IconButton>
                            ) : null}
                            <Drawer
                                anchor="left"
                                open={drawerOpen}
                                onClose={handleDrawerToggle}
                                PaperProps={{
                                    id: DRAWER_PAPER_ID,
                                    'aria-label': 'Site menu',
                                }}
                            >
                                {drawerContent}
                            </Drawer>
                        </>
                    ) : (
                        <>
                            <NavLink to={withDarkPath(pathname, '/')} style={{ flexShrink: 0 }}>
                                <img src={carwoodsLogo} alt="Carwoods" style={{ height: '40px' }} />
                            </NavLink>
                            <nav
                                aria-label="main navigation"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, flexWrap: 'wrap', rowGap: 4 }}
                            >
                                <NavLink to={withDarkPath(pathname, '/')} className={({ isActive }) => (isActive ? 'active' : '')}>
                                    Home
                                </NavLink>

                                <IconButton
                                    component="span"
                                    disableRipple
                                    id="tenant-menu-button"
                                    onClick={handleTenantOpen}
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(tenantAnchor)}
                                    aria-controls={tenantAnchor ? 'tenant-menu' : undefined}
                                    aria-label="Tenant menu"
                                    sx={{
                                        color: 'inherit',
                                        padding: '0.5rem 1rem',
                                        fontWeight: 'bold',
                                        fontSize: 'inherit',
                                        borderRadius: '4px',
                                        '&:hover': {
                                            backgroundColor: 'var(--nav-chrome-hover-bg)',
                                        },
                                    }}
                                >
                                    <span style={{ marginRight: '0.25rem' }}>Tenant</span>
                                    <KeyboardArrowDown fontSize="small" />
                                </IconButton>
                                <Menu
                                    id="tenant-menu"
                                    anchorEl={tenantAnchor}
                                    open={Boolean(tenantAnchor)}
                                    onClose={handleTenantClose}
                                    MenuListProps={{
                                        'aria-labelledby': 'tenant-menu-button',
                                    }}
                                    slotProps={{
                                        paper: {
                                            sx: { backgroundImage: 'none' },
                                        },
                                    }}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                >
                                    {tenantLinks.map(({ to, label }) => (
                                        <MenuItem
                                            key={to}
                                            component={NavLink}
                                            to={withDarkPath(pathname, to)}
                                            className={({ isActive }) => (isActive ? 'active' : '')}
                                            onClick={handleTenantClose}
                                            sx={{
                                                color: 'text.secondary',
                                                '&:hover': {
                                                    backgroundColor: 'var(--menu-item-hover-bg)',
                                                    color: 'var(--menu-item-hover-fg)',
                                                },
                                                '&.active': {
                                                    backgroundColor: 'var(--menu-item-active-bg)',
                                                    color: 'var(--menu-item-active-fg)',
                                                },
                                            }}
                                        >
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Menu>

                                <IconButton
                                    component="span"
                                    disableRipple
                                    id="landlord-menu-button"
                                    onClick={handleLandlordOpen}
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(landlordAnchor)}
                                    aria-controls={landlordAnchor ? 'landlord-menu' : undefined}
                                    aria-label="Landlord menu"
                                    sx={{
                                        color: 'inherit',
                                        padding: '0.5rem 1rem',
                                        fontWeight: 'bold',
                                        fontSize: 'inherit',
                                        borderRadius: '4px',
                                        '&:hover': {
                                            backgroundColor: 'var(--nav-chrome-hover-bg)',
                                        },
                                    }}
                                >
                                    <span style={{ marginRight: '0.25rem' }}>Landlord</span>
                                    <KeyboardArrowDown fontSize="small" />
                                </IconButton>
                                <Menu
                                    id="landlord-menu"
                                    anchorEl={landlordAnchor}
                                    open={Boolean(landlordAnchor)}
                                    onClose={handleLandlordClose}
                                    MenuListProps={{
                                        'aria-labelledby': 'landlord-menu-button',
                                    }}
                                    slotProps={{
                                        paper: {
                                            sx: { backgroundImage: 'none' },
                                        },
                                    }}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                >
                                    {landlordLinks.map(({ to, label }) => (
                                        <MenuItem
                                            key={to}
                                            component={NavLink}
                                            to={withDarkPath(pathname, to)}
                                            className={({ isActive }) => (isActive ? 'active' : '')}
                                            onClick={handleLandlordClose}
                                            sx={{
                                                color: 'text.secondary',
                                                '&:hover': {
                                                    backgroundColor: 'var(--menu-item-hover-bg)',
                                                    color: 'var(--menu-item-hover-fg)',
                                                },
                                                '&.active': {
                                                    backgroundColor: 'var(--menu-item-active-bg)',
                                                    color: 'var(--menu-item-active-fg)',
                                                },
                                            }}
                                        >
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Menu>

                                <NavLink to={withDarkPath(pathname, '/contact-us')} className={({ isActive }) => (isActive ? 'active' : '')}>
                                    Contact Us
                                </NavLink>

                                <Box
                                    component="span"
                                    aria-hidden="true"
                                    sx={{
                                        color: 'var(--nav-chrome-text)',
                                        opacity: 0.5,
                                        userSelect: 'none',
                                        px: 0.25,
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    |
                                </Box>

                                {legalLinks.map(({ to, label }, i) => (
                                    <React.Fragment key={to}>
                                        {i > 0 ? (
                                            <Box
                                                component="span"
                                                aria-hidden="true"
                                                sx={{
                                                    color: 'var(--nav-chrome-text)',
                                                    opacity: 0.5,
                                                    userSelect: 'none',
                                                    px: 0.25,
                                                    fontSize: '0.75rem',
                                                }}
                                            >
                                                |
                                            </Box>
                                        ) : null}
                                        <NavLink to={withDarkPath(pathname, to)} style={desktopLegalLinkStyle}>
                                            {label}
                                        </NavLink>
                                    </React.Fragment>
                                ))}

                                {showAppearanceMenu ? (
                                    <IconButton
                                        color="inherit"
                                        type="button"
                                        id="appearance-menu-button-toolbar"
                                        data-appearance-trigger="toolbar"
                                        aria-label="Appearance and theme"
                                        aria-haspopup="true"
                                        aria-expanded={Boolean(appearanceAnchor)}
                                        aria-controls={appearanceAnchor ? 'appearance-menu' : undefined}
                                        onClick={handleAppearanceOpen}
                                        sx={{ ml: 0.5 }}
                                    >
                                        <SettingsBrightness />
                                    </IconButton>
                                ) : null}
                            </nav>
                        </>
                    )}
                </Toolbar>
            </AppBar>
            {showAppearanceMenu ? (
                <Menu
                    id="appearance-menu"
                    anchorEl={appearanceAnchor}
                    open={Boolean(appearanceAnchor)}
                    onClose={handleAppearanceClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    slotProps={{
                        paper: {
                            sx: { backgroundImage: 'none' },
                        },
                        list: {
                            ...(appearanceMenuLabelledBy ? { 'aria-labelledby': appearanceMenuLabelledBy } : {}),
                        },
                    }}
                >
                    {isDarkPreviewPath && !FEATURE_DARK_THEME ? (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                                Dark preview
                            </Typography>
                            <Typography variant="body2" sx={{ px: 2, pb: 1, maxWidth: 280, color: 'text.secondary' }}>
                                URLs under <strong>/dark/…</strong> force dark styling for testing without enabling the feature flag.
                            </Typography>
                            <MenuItem
                                onClick={() => {
                                    navigate(stripDarkPreviewPrefix(pathname));
                                    handleAppearanceClose();
                                }}
                            >
                                <LightMode fontSize="small" sx={{ mr: 1 }} />
                                Exit preview (go home)
                            </MenuItem>
                        </>
                    ) : (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                                Color theme
                            </Typography>
                            <MenuItem
                                onClick={() => {
                                    setOverrideLight();
                                    handleAppearanceClose();
                                }}
                                selected={storedOverride === 'light'}
                            >
                                <LightMode fontSize="small" sx={{ mr: 1 }} />
                                Light
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    setOverrideDark();
                                    handleAppearanceClose();
                                }}
                                selected={storedOverride === 'dark'}
                            >
                                <DarkMode fontSize="small" sx={{ mr: 1 }} />
                                Dark
                            </MenuItem>
                            <Divider />
                            <MenuItem
                                onClick={() => {
                                    resetOverride();
                                    handleAppearanceClose();
                                }}
                                disabled={storedOverride === null}
                            >
                                <RestartAlt fontSize="small" sx={{ mr: 1 }} />
                                Use device setting
                            </MenuItem>
                            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', maxWidth: 260 }}>
                                Your choice is saved in this browser. Reset clears the override and follows your device again.
                            </Typography>
                        </>
                    )}
                </Menu>
            ) : null}
        </>
    );
};

export default ResponsiveNavbar;
