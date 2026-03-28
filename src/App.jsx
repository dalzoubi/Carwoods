import React, { useLayoutEffect, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AppShell, Container, Content, scrollToHashAnchor } from './styles';
import Home from './components/Home';
import Apply from './components/Apply';
import TenantSelectionCriteria from './components/TenantSelectionCriteria';
import ApplicationRequiredDocuments from './components/ApplicationRequiredDocuments';
import PropertyManagement from './components/PropertyManagement';
import ContactUs from './components/ContactUs';
import Privacy from './components/Privacy';
import Accessibility from './components/Accessibility';
import Footer from './components/Footer';
import ResponsiveNavbar from './components/ResponsiveNavbar';
import { isDarkPreviewRoute } from './routePaths';

/**
 * After route changes, scroll like “Back to top” links: smooth `scrollIntoView` on `#page-top`
 * and sync the hash. Skips when the URL already targets another in-page section.
 */
function ScrollToTopOnRouteChange() {
    const { pathname, hash } = useLocation();
    useLayoutEffect(() => {
        if (hash && hash !== '#page-top') return undefined;
        const raf = requestAnimationFrame(() => {
            scrollToHashAnchor('#page-top');
        });
        return () => cancelAnimationFrame(raf);
    }, [pathname, hash]);
    return null;
}

function PageRoutes() {
    const location = useLocation();
    const matchPathname = useMemo(() => {
        const p = location.pathname;
        if (isDarkPreviewRoute(p)) {
            if (p === '/dark') return '/';
            return p.slice('/dark'.length) || '/';
        }
        return p;
    }, [location.pathname]);

    const routesLocation = useMemo(
        () => ({ ...location, pathname: matchPathname }),
        [location, matchPathname]
    );

    return (
        <Routes location={routesLocation}>
            <Route path="/" element={<Home />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/tenant-selection-criteria" element={<TenantSelectionCriteria />} />
            <Route path="/application-required-documents" element={<ApplicationRequiredDocuments />} />
            <Route path="/property-management" element={<PropertyManagement />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/accessibility" element={<Accessibility />} />
        </Routes>
    );
}

const AppRoutes = () => {
    const location = useLocation();
    return (
        <Content key={location.pathname}>
            <span id="page-top" />
            <PageRoutes />
        </Content>
    );
};

const App = () => (
    <AppShell>
        <ScrollToTopOnRouteChange />
        <a href="#main-content" className="sr-only sr-only-focusable">
            Skip to main content
        </a>
        <ResponsiveNavbar />
        <Container id="main-content">
            <AppRoutes />
        </Container>
        <Footer />
        <Analytics />
    </AppShell>
);

export default App;
