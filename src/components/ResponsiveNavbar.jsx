import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    AppBar,
    Toolbar,
    IconButton,
    Button,
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
    Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Print from '@mui/icons-material/Print';
import Language from '@mui/icons-material/Language';
import Gavel from '@mui/icons-material/Gavel';
import Login from '@mui/icons-material/Login';
import { NavLink } from '../styles';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useThemeMode } from '../ThemeModeContext';
import { useLanguage } from '../LanguageContext';
import { usePortalAuth } from '../PortalAuthContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import { isPrintablePageRoute, stripDarkPreviewPrefix, withDarkPath } from '../routePaths';
import { useTranslation } from 'react-i18next';
import carwoodsLogo from '../assets/carwoods-logo.png';
import PortalNotificationsTray from './PortalNotificationsTray';
import {
    PORTAL_ACCOUNT_MENU_BUTTON_ID,
    PortalAccountMenu,
    PortalAccountMenuAvatarTrigger,
} from './PortalAccountMenu';

const DRAWER_PAPER_ID = 'main-navigation-drawer';

const LOGO_HEIGHT_PX = 32;
const MOBILE_LOGO_HEIGHT_PX = 28;

const headerNavLinkStyle = {
    padding: '0.3rem 0.55rem',
    fontSize: '0.9rem',
};

/** Matches theme/appearance control; visible focus ring for keyboard users (WCAG 2.4.7). */
const toolbarChromeIconButtonSx = {
    flexShrink: 0,
    color: 'inherit',
    borderRadius: '4px',
    transition: 'background-color 0.3s, color 0.3s',
    '&:hover': {
        backgroundColor: 'var(--nav-chrome-hover-bg)',
        color: 'var(--nav-chrome-active-text)',
    },
    '&.Mui-focusVisible': {
        outline: '2px solid var(--nav-chrome-focus-ring)',
        outlineOffset: 2,
    },
};

const signInCtaButtonSx = {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.85rem',
    px: 1.25,
    py: 0.45,
    borderRadius: 'var(--shape-border-radius)',
    backgroundColor: 'var(--cta-button-bg)',
    color: 'var(--cta-button-text)',
    border: '1px solid rgba(255,255,255,0.85)',
    boxShadow: 'none',
    transition: 'background-color 0.2s, color 0.2s, transform 0.2s',
    '&:hover': {
        backgroundColor: 'var(--cta-button-bg-hover)',
        color: 'var(--cta-button-text)',
        boxShadow: 'none',
        transform: 'translateY(-1px)',
    },
    '&:active': {
        transform: 'translateY(0)',
    },
    '&.Mui-focusVisible': {
        outline: '2px solid var(--palette-primary-light)',
        outlineOffset: 3,
    },
};

const logoLinkSx = {
    display: 'inline-block',
    lineHeight: 0,
    borderRadius: '4px',
    padding: '0.3rem 0.55rem',
    transition: 'background-color 0.3s, color 0.3s',
    '&:hover': {
        backgroundColor: 'var(--nav-chrome-hover-bg)',
    },
    '&:focus-visible': {
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
    const [rentersAnchor, setRentersAnchor] = useState(null);
    const [productAnchor, setProductAnchor] = useState(null);
    const [portalAnchor, setPortalAnchor] = useState(null);
    const [legalAnchor, setLegalAnchor] = useState(null);
    const [appearanceAnchor, setAppearanceAnchor] = useState(null);
    const [languageAnchor, setLanguageAnchor] = useState(null);
    const [accountAnchor, setAccountAnchor] = useState(null);
    const [appearanceMenuLabelledBy, setAppearanceMenuLabelledBy] = useState(undefined);
    const [languageMenuLabelledBy, setLanguageMenuLabelledBy] = useState(undefined);
    const notificationsTrayRef = useRef(null);
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
        supportedLanguages,
        changeLanguage,
        storedLanguageOverride,
        resetLanguagePreference,
    } = useLanguage();
    const { isAuthenticated, signIn } = usePortalAuth();
    const { t } = useTranslation();
    const portalLinkTo = '/portal';

    const menuHorizontalOrigin = muiTheme.direction === 'rtl' ? 'right' : 'left';
    const menuAnchorOrigin = { vertical: 'bottom', horizontal: menuHorizontalOrigin };
    const menuTransformOrigin = { vertical: 'top', horizontal: menuHorizontalOrigin };

    const showAppearanceMenu = darkThemeFeatureEnabled || isDarkPreviewPath;
    const showPrintButton = isPrintablePageRoute(pathname);
    const normalizedPathname = stripDarkPreviewPrefix(pathname);
    const stableMenuProps = {
        disableScrollLock: true,
        disableAutoFocusItem: true,
        disableAutoFocus: true,
        disableRestoreFocus: true,
    };

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
        setPortalAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setTenantAnchor(e.currentTarget);
    };
    const handleTenantClose = () => {
        setTenantAnchor(null);
    };
    const handleLandlordOpen = (e) => {
        setTenantAnchor(null);
        setPortalAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setLandlordAnchor(e.currentTarget);
    };
    const handleLandlordClose = () => {
        setLandlordAnchor(null);
    };
    const handleRentersOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setProductAnchor(null);
        setPortalAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setRentersAnchor(e.currentTarget);
    };
    const handleRentersClose = () => {
        setRentersAnchor(null);
    };
    const handleProductOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setRentersAnchor(null);
        setPortalAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setProductAnchor(e.currentTarget);
    };
    const handleProductClose = () => {
        setProductAnchor(null);
    };

    const handlePortalOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setRentersAnchor(null);
        setProductAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setPortalAnchor(e.currentTarget);
    };
    const handlePortalClose = () => {
        setPortalAnchor(null);
    };
    const handleLegalOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setRentersAnchor(null);
        setPortalAnchor(null);
        setProductAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setLegalAnchor(e.currentTarget);
    };
    const handleLegalClose = () => {
        setLegalAnchor(null);
    };
    const handleAppearanceOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setRentersAnchor(null);
        setPortalAnchor(null);
        setProductAnchor(null);
        setLegalAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
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
        setRentersAnchor(null);
        setPortalAnchor(null);
        setProductAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        notificationsTrayRef.current?.close();
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
    const handleAccountOpen = (e) => {
        setTenantAnchor(null);
        setLandlordAnchor(null);
        setRentersAnchor(null);
        setPortalAnchor(null);
        setProductAnchor(null);
        setLegalAnchor(null);
        setAppearanceAnchor(null);
        setLanguageAnchor(null);
        notificationsTrayRef.current?.close();
        setAccountAnchor(e.currentTarget);
    };
    const handleAccountClose = () => {
        setAccountAnchor(null);
    };
    const handleAccountButtonClick = (e) => {
        if (!isAuthenticated) {
            signIn().then((didSignIn) => {
                if (didSignIn) {
                    navigate(withDarkPath(pathname, '/portal'));
                }
            });
            return;
        }
        handleAccountOpen(e);
    };
    const rentersLinks = [
        { to: '/apply', label: t('tenantLinks.apply') },
        { to: '/tenant-selection-criteria', label: t('tenantLinks.selectionCriteria') },
        { to: '/application-required-documents', label: t('tenantLinks.requiredDocuments') },
    ];

    // "For Managers" dropdown: portal product pages
    const productNavLinks = [
        { to: '/features', label: 'All Features' },
        { to: '/pricing', label: t('nav.pricing') },
        { to: '/for-property-managers', label: t('nav.forPropertyManagers') },
    ];

    const legalLinks = [
        { to: '/privacy', label: t('nav.privacy') },
        { to: '/terms-of-service', label: t('nav.terms') },
        { to: '/accessibility', label: t('nav.accessibility') },
    ];
    const isRouteActive = (to) => normalizedPathname === to;

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
                <Tooltip title={t('nav.legal')} arrow>
                    <IconButton
                        color="inherit"
                        type="button"
                        size="small"
                        id="legal-menu-button"
                        onClick={handleLegalOpen}
                        aria-haspopup="true"
                        aria-expanded={Boolean(legalAnchor)}
                        aria-controls={legalAnchor ? 'legal-menu' : undefined}
                        aria-label={t('nav.legalMenu')}
                        sx={toolbarChromeIconButtonSx}
                    >
                        <Gavel aria-hidden />
                    </IconButton>
                </Tooltip>
            ) : null}
            {showPrintButton ? (
                <IconButton
                    color="inherit"
                    type="button"
                    size="small"
                    aria-label={t('nav.print')}
                    onClick={() => window.print()}
                    sx={toolbarChromeIconButtonSx}
                >
                    <Print aria-hidden />
                </IconButton>
            ) : null}
            {showAppearanceMenu ? (
                <Tooltip title={t('nav.appearance')} arrow>
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
                </Tooltip>
            ) : null}
            <Tooltip title={t('nav.language')} arrow>
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
            </Tooltip>
            {isAuthenticated ? (
                <PortalNotificationsTray
                    ref={notificationsTrayRef}
                    buttonId="notifications-menu-button"
                    menuId="notifications-menu"
                    onMenuWillOpen={() => {
                        setTenantAnchor(null);
                        setLandlordAnchor(null);
                        setRentersAnchor(null);
                        setPortalAnchor(null);
                        setProductAnchor(null);
                        setLegalAnchor(null);
                        setAppearanceAnchor(null);
                        setLanguageAnchor(null);
                        setAccountAnchor(null);
                    }}
                    iconButtonColor="inherit"
                    iconButtonSx={toolbarChromeIconButtonSx}
                    menuProps={stableMenuProps}
                />
            ) : null}
            {isAuthenticated ? (
                <PortalAccountMenuAvatarTrigger
                    onOpen={handleAccountOpen}
                    menuOpen={Boolean(accountAnchor)}
                    loadingPlaceholderSx={{ color: 'inherit' }}
                    circularProgressSx={{ color: 'inherit' }}
                />
            ) : (
                <>
                    {!isMobile && (
                        <Button
                            component={RouterLink}
                            to={withDarkPath(pathname, '/portal')}
                            type="button"
                            size="small"
                            variant="text"
                            id={PORTAL_ACCOUNT_MENU_BUTTON_ID}
                            aria-label={t('portalHeader.actions.signIn')}
                            startIcon={<Login fontSize="small" aria-hidden />}
                            sx={{
                                color: 'inherit',
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                px: 1,
                                opacity: 0.85,
                                '&:hover': { opacity: 1, backgroundColor: 'var(--nav-chrome-hover-bg)' },
                            }}
                        >
                            {t('portalHeader.actions.signIn')}
                        </Button>
                    )}
                    <Button
                        component={RouterLink}
                        to={withDarkPath(pathname, '/pricing')}
                        type="button"
                        size={isMobile ? 'small' : 'medium'}
                        variant="contained"
                        aria-label={t('nav.getStarted')}
                        sx={{
                            ...signInCtaButtonSx,
                            fontSize: isMobile ? '0.75rem' : signInCtaButtonSx.fontSize,
                            px: isMobile ? 1.1 : signInCtaButtonSx.px,
                        }}
                    >
                        {t('nav.getStarted')}
                    </Button>
                </>
            )}
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
        <div style={{ backgroundColor: muiTheme.palette.drawer.background, minHeight: '100%' }}>
            <nav aria-label={t('nav.siteMenu')}>
                <List disablePadding>
                    <ListItemButton
                        component={RouterLink}
                        to={withDarkPath(pathname, '/')}
                        selected={isRouteActive('/')}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary={t('nav.home')} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    {/* Renters section */}
                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        {t('nav.renters')}
                    </ListSubheader>
                    {rentersLinks.map(({ to, label }) => (
                        <ListItemButton
                            key={to}
                            component={RouterLink}
                            to={withDarkPath(pathname, to)}
                            selected={isRouteActive(to)}
                            onClick={handleDrawerToggle}
                            sx={{ pl: 3, ...listItemButtonSx }}
                        >
                            <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ))}

                    {/* Property Management — direct */}
                    <ListItemButton
                        component={RouterLink}
                        to={withDarkPath(pathname, '/property-management')}
                        selected={isRouteActive('/property-management')}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary={t('nav.propertyManagement')} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    {/* For Managers section */}
                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        {t('nav.forManagers')}
                    </ListSubheader>
                    {productNavLinks.map(({ to, label }) => (
                        <ListItemButton
                            key={to + label}
                            component={RouterLink}
                            to={withDarkPath(pathname, to)}
                            selected={isRouteActive(to)}
                            onClick={handleDrawerToggle}
                            sx={{ pl: 3, ...listItemButtonSx }}
                        >
                            <ListItemText primary={label} style={{ color: muiTheme.palette.drawer.text }} />
                        </ListItemButton>
                    ))}

                    <ListItemButton
                        component={RouterLink}
                        to={withDarkPath(pathname, '/contact-us')}
                        selected={isRouteActive('/contact-us')}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary={t('nav.contactUs')} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    <ListItemButton
                        component={RouterLink}
                        to={withDarkPath(pathname, portalLinkTo)}
                        selected={isRouteActive(portalLinkTo)}
                        onClick={handleDrawerToggle}
                        sx={listItemButtonSx}
                    >
                        <ListItemText primary={t('portalHeader.actions.signIn')} style={{ color: muiTheme.palette.drawer.text }} />
                    </ListItemButton>

                    <ListSubheader disableSticky disableGutters sx={{ ...subheaderSx, pt: 1.5 }}>
                        {t('nav.legal')}
                    </ListSubheader>
                    {legalLinks.map(({ to, label }) => (
                        <ListItemButton
                            key={to}
                            component={RouterLink}
                            to={withDarkPath(pathname, to)}
                            selected={isRouteActive(to)}
                            onClick={handleDrawerToggle}
                            sx={{ pl: 3, ...listItemButtonSx }}
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
                        minHeight: 48,
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
                                    width: '100%',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto 1fr',
                                    alignItems: 'center',
                                    columnGap: 0.5,
                                }}
                            >
                                <Box sx={{ justifySelf: 'start' }}>
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
                                </Box>
                                <Box
                                    sx={{
                                        minWidth: 0,
                                        lineHeight: 0,
                                        justifySelf: 'center',
                                    }}
                                >
                                    <Box
                                        component={RouterLink}
                                        to={withDarkPath(pathname, '/')}
                                        sx={logoLinkSx}
                                        aria-label={t('nav.home')}
                                    >
                                        <img src={carwoodsLogo} alt={t('common.carwoodsAlt')} style={{ height: `${MOBILE_LOGO_HEIGHT_PX}px`, display: 'block' }} />
                                    </Box>
                                </Box>
                                <Box sx={{ justifySelf: 'end', minWidth: 0, overflow: 'hidden' }}>{headerToolbarActions}</Box>
                            </Box>
                            <Drawer
                                anchor={muiTheme.direction === 'rtl' ? 'right' : 'left'}
                                open={drawerOpen}
                                onClose={handleDrawerToggle}
                                PaperProps={{
                                    id: DRAWER_PAPER_ID,
                                    'aria-label': t('nav.siteMenu'),
                                    sx: {
                                        backgroundColor: muiTheme.palette.drawer.background,
                                        color: muiTheme.palette.drawer.text,
                                        backgroundImage: 'none',
                                    },
                                }}
                            >
                                {drawerContent}
                            </Drawer>
                        </>
                    ) : (
                        <>
                            <Box
                                component={RouterLink}
                                to={withDarkPath(pathname, '/')}
                                sx={{ ...logoLinkSx, flexShrink: 0 }}
                                aria-label={t('nav.home')}
                            >
                                <img src={carwoodsLogo} alt={t('common.carwoodsAlt')} style={{ height: `${LOGO_HEIGHT_PX}px`, display: 'block' }} />
                            </Box>
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

                                {/* Renters dropdown */}
                                <IconButton
                                    component="span"
                                    disableRipple
                                    id="renters-menu-button"
                                    onClick={handleRentersOpen}
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(rentersAnchor)}
                                    aria-controls={rentersAnchor ? 'renters-menu' : undefined}
                                    aria-label={t('nav.rentersMenu')}
                                    sx={{
                                        color: 'inherit',
                                        padding: '0.3rem 0.55rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        borderRadius: '4px',
                                        '&:hover': { backgroundColor: 'var(--nav-chrome-hover-bg)' },
                                    }}
                                >
                                    <span style={{ marginInlineEnd: '0.2rem' }}>{t('nav.renters')}</span>
                                    <KeyboardArrowDown sx={{ fontSize: '1rem' }} />
                                </IconButton>
                                <Menu
                                    {...stableMenuProps}
                                    id="renters-menu"
                                    anchorEl={rentersAnchor}
                                    open={Boolean(rentersAnchor)}
                                    onClose={handleRentersClose}
                                    MenuListProps={{ 'aria-labelledby': 'renters-menu-button' }}
                                    slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
                                    anchorOrigin={menuAnchorOrigin}
                                    transformOrigin={menuTransformOrigin}
                                >
                                    {rentersLinks.map(({ to, label }) => (
                                        <MenuItem
                                            key={to}
                                            component={RouterLink}
                                            to={withDarkPath(pathname, to)}
                                            selected={isRouteActive(to)}
                                            onClick={handleRentersClose}
                                            sx={{
                                                color: 'text.secondary',
                                                '&:hover': { backgroundColor: 'var(--menu-item-hover-bg)', color: 'var(--menu-item-hover-fg)' },
                                                '&.Mui-selected': { backgroundColor: 'var(--menu-item-active-bg)', color: 'var(--menu-item-active-fg)' },
                                            }}
                                        >
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Menu>

                                {/* Property Management — direct link */}
                                <NavLink
                                    to={withDarkPath(pathname, '/property-management')}
                                    className={({ isActive }) => (isActive ? 'active' : '')}
                                    style={headerNavLinkStyle}
                                >
                                    {t('nav.propertyManagement')}
                                </NavLink>

                                {/* For Managers dropdown */}
                                <IconButton
                                    component="span"
                                    disableRipple
                                    id="product-menu-button"
                                    onClick={handleProductOpen}
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(productAnchor)}
                                    aria-controls={productAnchor ? 'product-menu' : undefined}
                                    aria-label={t('nav.forManagersMenu')}
                                    sx={{
                                        color: 'inherit',
                                        padding: '0.3rem 0.55rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        borderRadius: '4px',
                                        '&:hover': { backgroundColor: 'var(--nav-chrome-hover-bg)' },
                                    }}
                                >
                                    <span style={{ marginInlineEnd: '0.2rem' }}>{t('nav.forManagers')}</span>
                                    <KeyboardArrowDown sx={{ fontSize: '1rem' }} />
                                </IconButton>
                                <Menu
                                    {...stableMenuProps}
                                    id="product-menu"
                                    anchorEl={productAnchor}
                                    open={Boolean(productAnchor)}
                                    onClose={handleProductClose}
                                    MenuListProps={{ 'aria-labelledby': 'product-menu-button' }}
                                    slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
                                    anchorOrigin={menuAnchorOrigin}
                                    transformOrigin={menuTransformOrigin}
                                >
                                    {productNavLinks.map(({ to, label }) => (
                                        <MenuItem
                                            key={to + label}
                                            component={RouterLink}
                                            to={withDarkPath(pathname, to)}
                                            selected={isRouteActive(to)}
                                            onClick={handleProductClose}
                                            sx={{
                                                color: 'text.secondary',
                                                '&:hover': { backgroundColor: 'var(--menu-item-hover-bg)', color: 'var(--menu-item-hover-fg)' },
                                                '&.Mui-selected': { backgroundColor: 'var(--menu-item-active-bg)', color: 'var(--menu-item-active-fg)' },
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
                    {...stableMenuProps}
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
                {...stableMenuProps}
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
                        component={RouterLink}
                        to={withDarkPath(pathname, to)}
                        selected={isRouteActive(to)}
                        onClick={handleLegalClose}
                        sx={{
                            color: 'text.secondary',
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
                        {label}
                    </MenuItem>
                ))}
            </Menu>
            <Menu
                {...stableMenuProps}
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
                        selected={storedLanguageOverride === lang}
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
            <PortalAccountMenu
                anchorEl={accountAnchor}
                open={isAuthenticated && Boolean(accountAnchor)}
                onClose={handleAccountClose}
                menuProps={stableMenuProps}
            />
        </>
    );
};

export default ResponsiveNavbar;
