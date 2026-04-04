import React, { useLayoutEffect, useRef, useState } from 'react';
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
import Print from '@mui/icons-material/Print';
import Language from '@mui/icons-material/Language';
import { NavLink } from '../styles';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useThemeMode } from '../ThemeModeContext';
import { useLanguage } from '../LanguageContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import { isPrintablePageRoute, stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import { useTranslation } from 'react-i18next';
import carwoodsLogo from '../assets/carwoods-logo.png';

const DRAWER_PAPER_ID = 'main-navigation-drawer';

const LOGO_HEIGHT_PX = 32;
const MOBILE_LOGO_HEIGHT_PX = 30;

const headerNavLinkStyle = {
    padding: '0.3rem 0.55rem',
    fontSize: '0.9rem',
};

/** Matches theme/appearance control; visible focus ring for keyboard users (WCAG 2.4.7). */
const toolbarChromeIconButtonSx = {
    flexShrink: 0,
    color: 'inherit',
    '&.Mui-focusVisible': {
        outline: '2px solid var(--nav-chrome-focus-ring)',
        outlineOffset: 2,
    },
};

const ResponsiveNavbar = () => {
    const appBarRef = useRef(null);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tenantAnchor, setTenantAnchor] = useState(null);
    const [landlordAnchor, setLandlordAnchor] = useState(null);
    const [legalAnchor, setLegalAnchor] = useState(null);
    const [appearanceAnchor, setAppearanceAnchor] = useState(null);
    const [languageAnchor, setLanguageAnchor] = useState(null);
    const [appearanceMenuLabelledBy, setAppearanceMenuLabelledBy] = useState(undefined);
    const [languageMenuLabelledBy, setLanguageMenuLabelledBy] = useState(undefined);
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('lg'));
    const {
        storedOverride,
        darkThemeFeatureEnabled,
        isDarkPreviewPath,
        setOverrideLight,
        setOverrideDark,
        resetOverride,
    } = useThemeMode();
    const {
        currentLanguage,
        supportedLanguages,
        changeLanguage,
        storedLanguageOverride,
        resetLanguagePreference,
    } = useLanguage();
    const { t } = useTranslation();

    const menuHorizontalOrigin = muiTheme.direction === 'rtl' ? 'right' : 'left';
    const menuAnchorOrigin = { vertical: 'bottom', horizontal: menuHorizontalOrigin };
    const menuTransformOrigin = { vertical: 'top', horizontal: menuHorizontalOrigin };

    const showAppearanceMenu = darkThemeFeatureEnabled || isDarkPreviewPath;
    const showPrintButton = isPrintablePageRoute(pathname);

    useLayoutEffect(() => {
        const el = appBarRef.current;
        if (!el) return undefined;
        const syncStickyOffset = () => {
            document.documentElement.style.setProperty(
                '--sticky-nav-offset',
                `${Math.round(el.getBoundingClientRect().height)}px`
            );
        };
        syncStickyOffset();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', syncStickyOffset);
            return () => window.removeEventListener('resize', syncStickyOffset);
        }
        const ro = new ResizeObserver(syncStickyOffset);
        ro.observe(el);
        return () => {
            ro.disconnect();
        };
    }, []);

    const handleDrawerToggle = () => {
        setDrawerOpen(!drawerOpen);
    };

    const handleTenantOpen = (e) => {
        setLandlordAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        setTenantAnchor(e.currentTarget);
    };
    const handleTenantClose = () => {
        setTenantAnchor(null);
    };
    const handleLandlordOpen = (e) => {
        setTenantAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        setLandlordAnchor(e.currentTarget);
    };
    const handleLandlordClose = () => {
        setLandlordAnchor(null);
    };
    const handleLegalOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        setLegalAnchor(e.currentTarget);
    };
    const handleLegalClose = () => {
        setLegalAnchor(null);
    };
    const handleAppearanceOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setLegalAnchor(null);
        setLanguageAnchor(null);
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
    const handleLanguageOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(e.currentTarget);
        const trigger = e.currentTarget.getAttribute('data-language-trigger');
        setLanguageMenuLabelledBy(
            trigger === 'drawer' ? 'language-menu-button-drawer' : 'language-menu-button-toolbar'
        );
    };
    const handleLanguageClose = () => {
        setLanguageAnchor(null);
        setLanguageMenuLabelledBy(undefined);
    };

    const tenantLinks = [
        { to: '/apply', label: t('tenantLinks.apply') },
        { to: '/tenant-selection-criteria', label: t('tenantLinks.selectionCriteria') },
        { to: '/application-required-documents', label: t('tenantLinks.requiredDocuments') },
        { to: '/portal/tenant', label: t('tenantLinks.tenantPortal') },
    ];

    const landlordLinks = [
        { to: '/property-management', label: t('landlordLinks.propertyManagement') },
        { to: '/portal/admin', label: t('landlordLinks.landlordPortal') },
    ];

    const legalLinks = [
        { to: '/privacy', label: t('nav.privacy') },
        { to: '/terms-of-service', label: t('nav.terms') },
        { to: '/accessibility', label: t('nav.accessibility') },
    ];

    const showToolbarActions = showPrintButton || showAppearanceMenu || true; // language always shown
    const headerToolbarActions = showToolbarActions ? (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                gap: 0.5,
                ml: { xs: 0, md: 'auto' },
            }}
        >
            {!isMobile ? (
                <IconButton
                    component="span"
                    disableRipple
                    id="legal-menu-button"
                    onClick={handleLegalOpen}
                    aria-haspopup="true"
                    aria-expanded={Boolean(legalAnchor)}
                    aria-controls={legalAnchor ? 'legal-menu' : undefined}
                    aria-label={t('nav.legal')}
                    sx={{
                        color: 'inherit',
                        padding: '0.2rem 0.45rem',
                        fontWeight: 500,
                        fontSize: '0.78rem',
                        borderRadius: '4px',
                        '&:hover': {
                            backgroundColor: 'var(--nav-chrome-hover-bg)',
                        },
                        '&.Mui-focusVisible': {
                            outline: '2px solid var(--nav-chrome-focus-ring)',
                            outlineOffset: 2,
                        },
                    }}
                >
                    <span style={{ marginInlineEnd: '0.15rem' }}>{t('nav.legal')}</span>
                    <KeyboardArrowDown sx={{ fontSize: '0.9rem' }} />
                </IconButton>
            ) : null}
            {showPrintButton ? (
                <IconButton
                    color="inherit"
                    type="button"
                    size="small"
                    aria-label={t('nav.print', 'Print this page')}
                    onClick={() => window.print()}
                    sx={toolbarChromeIconButtonSx}
                >
                    <Print aria-hidden />
                </IconButton>
            ) : null}
            {showAppearanceMenu ? (
                <IconButton
                    color="inherit"
                    type="button"
                    size="small"
                    id="appearance-menu-button-toolbar"
                    data-appearance-trigger="toolbar"
                    aria-label={t('nav.appearance')}
                    aria-haspopup="true"
                    aria-expanded={Boolean(appearanceAnchor)}
                    aria-controls={appearanceAnchor ? 'appearance-menu' : undefined}
                    onClick={handleAppearanceOpen}
                    sx={toolbarChromeIconButtonSx}
                >
                    <SettingsBrightness aria-hidden />
                </IconButton>
            ) : null}
            <IconButton
                color="inherit"
                type="button"
                size="small"
                id="language-menu-button-toolbar"
                data-language-trigger="toolbar"
                aria-label={t('nav.selectLanguage')}
                aria-haspopup="true"
                aria-expanded={Boolean(languageAnchor)}
                aria-controls={languageAnchor ? 'language-menu' : undefined}
                onClick={handleLanguageOpen}
                sx={toolbarChromeIconButtonSx}
            >
                <Language aria-hidden />
            </IconButton>
        </Box>
    ) : null;

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
            <nav aria-label={t('nav.home')}>
                <List disablePadding>
                    <ListItemButton
                        component={NavLink}
                        to={withDarkPath(pathname, '/')}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary={t('nav.home')} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        {t('nav.tenant')}
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
                        {t('nav.landlord')}
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
                        <ListItemText primary={t('nav.contactUs')} style={{ color: muiTheme.palette.drawer.text }} />
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
                            <ListItemText primary={t('nav.appearance')} style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ) : null}

                    <ListItemButton
                        onClick={handleLanguageOpen}
                        aria-haspopup="true"
                        aria-expanded={Boolean(languageAnchor)}
                        aria-controls={languageAnchor ? 'language-menu' : undefined}
                        id="language-menu-button-drawer"
                        data-language-trigger="drawer"
                        sx={{
                            ...listItemButtonSx,
                            '&:hover': {
                                backgroundColor: muiTheme.palette.drawer.hover,
                            },
                        }}
                    >
                        <Language sx={{ mr: 1.5, color: muiTheme.palette.drawer.text }} fontSize="small" />
                        <ListItemText primary={t('nav.language')} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        {t('nav.legal')}
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

    return (
        <>
            <AppBar
                ref={appBarRef}
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
                    variant="dense"
                    sx={{
                        minHeight: { xs: 44, sm: 48 },
                        px: { xs: 1, sm: 1.5 },
                        flexWrap: 'wrap',
                        rowGap: 0.25,
                        columnGap: 0.25,
                    }}
                >
                    {isMobile ? (
                        <>
                            <Box
                                sx={{
                                    position: 'relative',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <IconButton
                                    edge="start"
                                    color="inherit"
                                    type="button"
                                    size="small"
                                    aria-label={t('nav.openMenu')}
                                    aria-haspopup="dialog"
                                    aria-expanded={drawerOpen}
                                    aria-controls={drawerOpen ? DRAWER_PAPER_ID : undefined}
                                    onClick={handleDrawerToggle}
                                >
                                    <MenuIcon fontSize="small" />
                                </IconButton>
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        minWidth: 0,
                                        lineHeight: 0,
                                    }}
                                >
                                    <RouterLink
                                        to={withDarkPath(pathname, '/')}
                                        style={{ display: 'inline-block', lineHeight: 0 }}
                                    >
                                        <img src={carwoodsLogo} alt={t('common.carwoodsAlt')} style={{ height: `${MOBILE_LOGO_HEIGHT_PX}px`, display: 'block' }} />
                                    </RouterLink>
                                </Box>
                                <Box sx={{ marginInlineStart: 'auto' }}>{headerToolbarActions}</Box>
                            </Box>
                            <Drawer
                                anchor={muiTheme.direction === 'rtl' ? 'right' : 'left'}
                                open={drawerOpen}
                                onClose={handleDrawerToggle}
                                PaperProps={{
                                    id: DRAWER_PAPER_ID,
                                    'aria-label': t('nav.siteMenu'),
                                }}
                            >
                                {drawerContent}
                            </Drawer>
                        </>
                    ) : (
                        <>
                            <RouterLink
                                to={withDarkPath(pathname, '/')}
                                style={{ flexShrink: 0, display: 'inline-block', lineHeight: 0 }}
                            >
                                <img src={carwoodsLogo} alt={t('common.carwoodsAlt')} style={{ height: `${LOGO_HEIGHT_PX}px`, display: 'block' }} />
                            </RouterLink>
                            <nav
                                aria-label={t('nav.mainNavigation')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexGrow: 1,
                                    flexWrap: 'wrap',
                                    rowGap: 2,
                                }}
                            >
                                <NavLink
                                    to={withDarkPath(pathname, '/')}
                                    className={({ isActive }) => (isActive ? 'active' : '')}
                                    style={headerNavLinkStyle}
                                >
                                    {t('nav.home')}
                                </NavLink>

                                <IconButton
                                    component="span"
                                    disableRipple
                                    id="tenant-menu-button"
                                    onClick={handleTenantOpen}
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(tenantAnchor)}
                                    aria-controls={tenantAnchor ? 'tenant-menu' : undefined}
                                    aria-label={t('nav.tenantMenu')}
                                    sx={{
                                        color: 'inherit',
                                        padding: '0.3rem 0.55rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        borderRadius: '4px',
                                        '&:hover': {
                                            backgroundColor: 'var(--nav-chrome-hover-bg)',
                                        },
                                    }}
                                >
                                    <span style={{ marginInlineEnd: '0.2rem' }}>{t('nav.tenant')}</span>
                                    <KeyboardArrowDown sx={{ fontSize: '1rem' }} />
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
                                    anchorOrigin={menuAnchorOrigin}
                                    transformOrigin={menuTransformOrigin}
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
                                    aria-label={t('nav.landlordMenu')}
                                    sx={{
                                        color: 'inherit',
                                        padding: '0.3rem 0.55rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        borderRadius: '4px',
                                        '&:hover': {
                                            backgroundColor: 'var(--nav-chrome-hover-bg)',
                                        },
                                    }}
                                >
                                    <span style={{ marginInlineEnd: '0.2rem' }}>{t('nav.landlord')}</span>
                                    <KeyboardArrowDown sx={{ fontSize: '1rem' }} />
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
                                    anchorOrigin={menuAnchorOrigin}
                                    transformOrigin={menuTransformOrigin}
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

                                <NavLink to={withDarkPath(pathname, '/contact-us')} className={({ isActive }) => (isActive ? 'active' : '')} style={headerNavLinkStyle}>
                                    {t('nav.contactUs')}
                                </NavLink>
                            </nav>
                            {headerToolbarActions}
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
                                {t('appearance.darkPreview')}
                            </Typography>
                            <Typography variant="body2" sx={{ px: 2, pb: 1, maxWidth: 280, color: 'text.secondary' }}>
                                {t('appearance.darkPreviewDescription')}
                            </Typography>
                            <MenuItem
                                onClick={() => {
                                    navigate(stripDarkPreviewPrefix(pathname));
                                    handleAppearanceClose();
                                }}
                            >
                                <LightMode fontSize="small" sx={{ mr: 1 }} />
                                {t('appearance.exitPreview')}
                            </MenuItem>
                        </>
                    ) : (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                                {t('appearance.colorTheme')}
                            </Typography>
                            <MenuItem
                                onClick={() => {
                                    setOverrideLight();
                                    handleAppearanceClose();
                                }}
                                selected={storedOverride === 'light'}
                            >
                                <LightMode fontSize="small" sx={{ mr: 1 }} />
                                {t('appearance.light')}
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    setOverrideDark();
                                    handleAppearanceClose();
                                }}
                                selected={storedOverride === 'dark'}
                            >
                                <DarkMode fontSize="small" sx={{ mr: 1 }} />
                                {t('appearance.dark')}
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
                                {t('appearance.useDeviceSetting')}
                            </MenuItem>
                            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', maxWidth: 260 }}>
                                {t('appearance.deviceSettingHint')}
                            </Typography>
                        </>
                    )}
                </Menu>
            ) : null}
            <Menu
                id="legal-menu"
                anchorEl={legalAnchor}
                open={Boolean(legalAnchor)}
                onClose={handleLegalClose}
                MenuListProps={{
                    'aria-labelledby': 'legal-menu-button',
                }}
                slotProps={{
                    paper: {
                        sx: { backgroundImage: 'none' },
                    },
                }}
                anchorOrigin={menuAnchorOrigin}
                transformOrigin={menuTransformOrigin}
            >
                {legalLinks.map(({ to, label }) => (
                    <MenuItem
                        key={to}
                        component={NavLink}
                        to={withDarkPath(pathname, to)}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={handleLegalClose}
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
            <Menu
                id="language-menu"
                anchorEl={languageAnchor}
                open={Boolean(languageAnchor)}
                onClose={handleLanguageClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: { backgroundImage: 'none' },
                    },
                    list: {
                        'aria-label': t('nav.selectLanguage'),
                        ...(languageMenuLabelledBy ? { 'aria-labelledby': languageMenuLabelledBy } : {}),
                    },
                }}
            >
                <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                    {t('nav.language')}
                </Typography>
                {supportedLanguages.map((lang) => (
                    <MenuItem
                        key={lang}
                        selected={currentLanguage === lang}
                        onClick={() => {
                            changeLanguage(lang);
                            handleLanguageClose();
                        }}
                        lang={lang}
                        sx={{
                            '&:hover': {
                                backgroundColor: 'var(--menu-item-hover-bg)',
                                color: 'var(--menu-item-hover-fg)',
                            },
                            '&.Mui-selected': {
                                backgroundColor: 'var(--menu-item-active-bg)',
                                color: 'var(--menu-item-active-fg)',
                            },
                        }}
                    >
                        {t(`languageNames.${lang}`)}
                    </MenuItem>
                ))}
                <Divider />
                <MenuItem
                    onClick={() => {
                        void resetLanguagePreference();
                        handleLanguageClose();
                    }}
                    disabled={storedLanguageOverride === null}
                >
                    <RestartAlt fontSize="small" sx={{ marginInlineEnd: 1 }} />
                    {t('languagePreference.useBrowserLanguage')}
                </MenuItem>
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', maxWidth: 260 }}>
                    {t('languagePreference.browserLanguageHint')}
                </Typography>
            </Menu>
        </>
    );
};

export default ResponsiveNavbar;
