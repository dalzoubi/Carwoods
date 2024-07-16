import React, { useState } from 'react';
import {
    AppBar,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItemButton,
    ListItemText,
    CssBaseline,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { NavLink } from '../styles';
import theme from '../theme';
import carwoodsLogo from '../assets/carwoods-logo.png';

const ResponsiveNavbar = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

    const handleDrawerToggle = () => {
        setDrawerOpen(!drawerOpen);
    };

    const drawerContent = (
        <div style={{ backgroundColor: theme.palette.drawer.background, height: '100%' }}>
            <List>
                <ListItemButton
                    component={NavLink}
                    to="/"
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: theme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Home" style={{ color: theme.palette.drawer.text }} />
                </ListItemButton>
                <ListItemButton
                    component={NavLink}
                    to="/tenant-selection-criteria"
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: theme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Tenant Selection Criteria" style={{ color: theme.palette.drawer.text }} />
                </ListItemButton>
                <ListItemButton
                    component={NavLink}
                    to="/application-required-documents"
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: theme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Application Required Documents" style={{ color: theme.palette.drawer.text }} />
                </ListItemButton>
                <ListItemButton
                    component={NavLink}
                    to="/property-management"
                    onClick={handleDrawerToggle}
                    sx={{
                        '&:hover': {
                            backgroundColor: theme.palette.drawer.hover,
                        },
                    }}
                >
                    <ListItemText primary="Property Management" style={{ color: theme.palette.drawer.text }} />
                </ListItemButton>
            </List>
        </div>
    );

    return (
        <>
            <CssBaseline />
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
                            <NavLink to="/" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                                <img src={carwoodsLogo} alt="Carwoods" style={{ height: '40px' }} />
                            </NavLink>
                            <nav aria-label="main navigation" style={{ marginLeft: 'auto', marginRight: 'auto', display: 'flex', justifyContent: 'center', flexGrow: 1 }}>
                                <NavLink to="/" activeClassName="active">Home</NavLink>
                                <NavLink to="/tenant-selection-criteria" activeClassName="active">Tenant Selection Criteria</NavLink>
                                <NavLink to="/application-required-documents" activeClassName="active">Application Required Documents</NavLink>
                                <NavLink to="/property-management" activeClassName="active">Property Management</NavLink>
                            </nav>
                        </>
                    )}
                </Toolbar>
            </AppBar>
        </>
    );
};

export default ResponsiveNavbar;
