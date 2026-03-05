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
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { NavLink } from '../styles';
import theme from '../theme';
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
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tenantAnchor, setTenantAnchor] = useState(null);
    const [landlordAnchor, setLandlordAnchor] = useState(null);
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

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

    const drawerContent = (
        <div style={{ backgroundColor: theme.palette.drawer.background, height: '100%' }}>
            <List>
                <ListItemButton
                    component={NavLink}
                    to="/"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: theme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Home" style={{ color: theme.palette.drawer.text }} />
                </ListItemButton>

                <ListItemText
                    primary="Tenant"
                    sx={{
                        color: theme.palette.drawer.text,
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
                                backgroundColor: theme.palette.drawer.hover,
                            },
                        }}
                    >
                        <ListItemText primary={label} style={{ color: theme.palette.drawer.text }} />
                    </ListItemButton>
                ))}

                <ListItemText
                    primary="Landlord"
                    sx={{
                        color: theme.palette.drawer.text,
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
                                backgroundColor: theme.palette.drawer.hover,
                            },
                        }}
                    >
                        <ListItemText primary={label} style={{ color: theme.palette.drawer.text }} />
                    </ListItemButton>
                ))}

                <ListItemButton
                    component={NavLink}
                    to="/contact-us"
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: theme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Contact Us" style={{ color: theme.palette.drawer.text }} />
                </ListItemButton>
            </List>
        </div>
    );

    return (
        <>
            <AppBar position="static" style={{ backgroundColor: theme.palette.primary.main, width: '100%' }}>
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
                                        padding: '0.5rem 0.25rem 0.5rem 1rem',
                                        '&:hover': {
                                            backgroundColor: theme.palette.drawer.hover,
                                            borderRadius: '4px',
                                        },
                                    }}
                                >
                                    <span style={{ fontWeight: 'bold', marginRight: '0.25rem' }}>Tenant</span>
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
                                                color: theme.palette.text.secondary,
                                                '&:hover': {
                                                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                                    color: theme.palette.primary.dark,
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
                                        padding: '0.5rem 0.25rem 0.5rem 1rem',
                                        '&:hover': {
                                            backgroundColor: theme.palette.drawer.hover,
                                            borderRadius: '4px',
                                        },
                                    }}
                                >
                                    <span style={{ fontWeight: 'bold', marginRight: '0.25rem' }}>Landlord</span>
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
                                                color: theme.palette.text.secondary,
                                                '&:hover': {
                                                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                                    color: theme.palette.primary.dark,
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
                            </nav>
                        </>
                    )}
                </Toolbar>
            </AppBar>
        </>
    );
};

export default ResponsiveNavbar;
