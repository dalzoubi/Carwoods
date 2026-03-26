import React, { useState } from 'react';
import {
    AppBar,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItemButton,
    ListItemText,
    Menu,
    MenuItem,
    useTheme,
    useMediaQuery,
    Divider,
    Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import RestartAlt from '@mui/icons-material/RestartAlt';
import { NavLink } from '../styles';
import { useNavigate } from 'react-router-dom';
import { useThemeMode } from '../ThemeModeContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import carwoodsLogo from '../assets/carwoods-logo.png';

const tenantLinks = [
    { to: '/apply', label: 'Apply' },
    { to: '/tenant-selection-criteria', label: 'Selection Criteria' },
    { to: '/application-required-documents', label: 'Required Documents' },
];

const landlordLinks = [
    { to: '/property-management', label: 'Property Management' },
];

const ResponsiveNavbar = () => {
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tenantAnchor, setTenantAnchor] = useState(null);
    const [landlordAnchor, setLandlordAnchor] = useState(null);
    const [appearanceAnchor, setAppearanceAnchor] = useState(null);
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
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
        setTenantAnchor(e.currentTarget);
    };
    const handleTenantClose = () => {
        setTenantAnchor(null);
    };
    const handleLandlordOpen = (e) => {
        setLandlordAnchor(e.currentTarget);
    };
    const handleLandlordClose = () => {
        setLandlordAnchor(null);
    };
    const handleAppearanceOpen = (e) => {
        setAppearanceAnchor(e.currentTarget);
    };
    const handleAppearanceClose = () => {
        setAppearanceAnchor(null);
    };

    const drawerContent = (
        <div style={{ backgroundColor: muiTheme.palette.drawer.background, height: '100%' }}>
            <List>
                <ListItemButton
                    component={NavLink}
                    to="/"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: muiTheme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Home" style={{ color: muiTheme.palette.drawer.text }} />
                </ListItemButton>

                <ListItemText
                    primary="Tenant"
                    sx={{
                        color: muiTheme.palette.drawer.text,
                        paddingLeft: 2,
                        paddingTop: 1,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        opacity: 0.9,
                    }}
                />
                {tenantLinks.map(({ to, label }) => (
                    <ListItemButton
                        key={to}
                        component={NavLink}
                        to={to}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={handleDrawerToggle}
                        sx={{
                            pl: 3,
                            '&:hover': {
                                backgroundColor: muiTheme.palette.drawer.hover,
                            },
                        }}
                    >
                        <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>
                ))}

                <ListItemText
                    primary="Landlord"
                    sx={{
                        color: muiTheme.palette.drawer.text,
                        paddingLeft: 2,
                        paddingTop: 1.5,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        opacity: 0.9,
                    }}
                />
                {landlordLinks.map(({ to, label }) => (
                    <ListItemButton
                        key={to}
                        component={NavLink}
                        to={to}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={handleDrawerToggle}
                        sx={{
                            pl: 3,
                            '&:hover': {
                                backgroundColor: muiTheme.palette.drawer.hover,
                            },
                        }}
                    >
                        <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>
                ))}

                <ListItemButton
                    component={NavLink}
                    to="/contact-us"
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: muiTheme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Contact Us" style={{ color: muiTheme.palette.drawer.text }} />
                </ListItemButton>
            </List>
        </div>
    );

    return (
        <>
            <AppBar
                position="static"
                style={{ backgroundColor: muiTheme.palette.appChrome.main, width: '100%' }}
            >
                <Toolbar>
                    {isMobile ? (
                        <>
                            <IconButton
                                edge="start"
                                color="inherit"
                                aria-label="open drawer"
                                aria-haspopup="true"
                                aria-expanded={drawerOpen}
                                onClick={handleDrawerToggle}
                            >
                                <MenuIcon />
                            </IconButton>
                            <NavLink to="/" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                                <img src={carwoodsLogo} alt="Carwoods" style={{ height: '40px' }} />
                            </NavLink>
                            {showAppearanceMenu ? (
                                <IconButton
                                    edge="end"
                                    color="inherit"
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
                                aria-label="menu drawer"
                            >
                                {drawerContent}
                            </Drawer>
                        </>
                    ) : (
                        <>
                            <NavLink to="/" style={{ flexShrink: 0 }}>
                                <img src={carwoodsLogo} alt="Carwoods" style={{ height: '40px' }} />
                            </NavLink>
                            <nav aria-label="main navigation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                                <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    Home
                                </NavLink>

                                <IconButton
                                    component="span"
                                    disableRipple
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
                                        '&:hover': {
                                            backgroundColor: muiTheme.palette.primary.dark,
                                            borderRadius: '4px',
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
                                        'aria-labelledby': 'tenant-menu',
                                    }}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                >
                                    {tenantLinks.map(({ to, label }) => (
                                        <MenuItem
                                            key={to}
                                            component={NavLink}
                                            to={to}
                                            className={({ isActive }) => (isActive ? 'active' : '')}
                                            onClick={handleTenantClose}
                                            sx={{
                                                color: muiTheme.palette.text.secondary,
                                                '&:hover': {
                                                    backgroundColor: 'var(--menu-item-hover-bg)',
                                                    color: muiTheme.palette.primary.dark,
                                                },
                                                '&.active': {
                                                    backgroundColor: muiTheme.palette.primary.dark,
                                                    color: muiTheme.palette.text.primary,
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
                                        '&:hover': {
                                            backgroundColor: muiTheme.palette.primary.dark,
                                            borderRadius: '4px',
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
                                        'aria-labelledby': 'landlord-menu',
                                    }}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                >
                                    {landlordLinks.map(({ to, label }) => (
                                        <MenuItem
                                            key={to}
                                            component={NavLink}
                                            to={to}
                                            className={({ isActive }) => (isActive ? 'active' : '')}
                                            onClick={handleLandlordClose}
                                            sx={{
                                                color: muiTheme.palette.text.secondary,
                                                '&:hover': {
                                                    backgroundColor: 'var(--menu-item-hover-bg)',
                                                    color: muiTheme.palette.primary.dark,
                                                },
                                                '&.active': {
                                                    backgroundColor: muiTheme.palette.primary.dark,
                                                    color: muiTheme.palette.text.primary,
                                                },
                                            }}
                                        >
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Menu>

                                <NavLink to="/contact-us" className={({ isActive }) => (isActive ? 'active' : '')}>
                                    Contact Us
                                </NavLink>

                                {showAppearanceMenu ? (
                                    <IconButton
                                        color="inherit"
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
                        list: {
                            'aria-labelledby': 'appearance-menu',
                        },
                    }}
                >
                    {isDarkPreviewPath && !FEATURE_DARK_THEME ? (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                                Dark preview
                            </Typography>
                            <Typography variant="body2" sx={{ px: 2, pb: 1, maxWidth: 280, color: 'text.secondary' }}>
                                You are on <strong>/dark</strong>. This route forces dark styling for testing without enabling the feature flag.
                            </Typography>
                            <MenuItem
                                onClick={() => {
                                    navigate('/');
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
