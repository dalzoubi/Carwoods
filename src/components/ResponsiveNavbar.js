import React, { useState } from 'react';
import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Drawer,
    List,
    ListItem,
    ListItemText,
    CssBaseline,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { NavLink } from '../styles';
import theme from '../theme';

const ResponsiveNavbar = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

    const handleDrawerToggle = () => {
        setDrawerOpen(!drawerOpen);
    };

    const drawer = (
        <List>
            <ListItem button component={NavLink} to="/" onClick={handleDrawerToggle}>
                <ListItemText primary="Home" />
            </ListItem>
            <ListItem button component={NavLink} to="/tenant-selection-criteria" onClick={handleDrawerToggle}>
                <ListItemText primary="Tenant Selection Criteria" />
            </ListItem>
            <ListItem button component={NavLink} to="/application-required-documents" onClick={handleDrawerToggle}>
                <ListItemText primary="Application Required Documents" />
            </ListItem>
            <ListItem button component={NavLink} to="/property-management" onClick={handleDrawerToggle}>
                <ListItemText primary="Property Management" />
            </ListItem>
        </List>
    );

    return (
        <>
            <CssBaseline />
            <AppBar position="static" style={{ backgroundColor: theme.primary, width: '100%' }}>
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
                            <Typography variant="h6" noWrap>
                                Carwoods
                            </Typography>
                            <Drawer
                                anchor="left"
                                open={drawerOpen}
                                onClose={handleDrawerToggle}
                                aria-label="menu drawer"
                            >
                                {drawer}
                            </Drawer>
                        </>
                    ) : (
                        <>
                            <Typography variant="h6" noWrap style={{ flexGrow: 1, textAlign: 'center' }}>
                                Carwoods
                            </Typography>
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
