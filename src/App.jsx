import React, { useLayoutEffect, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell, Container, Content, scrollToHashAnchor } from './styles';
import Home from './components/Home';
import Apply from './components/Apply';
import TenantSelectionCriteria from './components/TenantSelectionCriteria';
import ApplicationRequiredDocuments from './components/ApplicationRequiredDocuments';
import PropertyManagement from './components/PropertyManagement';
import ContactUs from './components/ContactUs';
import Privacy from './components/Privacy';
import Accessibility from './components/Accessibility';
import TermsOfService from './components/TermsOfService';
import Footer from './components/Footer';
import ResponsiveNavbar from './components/ResponsiveNavbar';
import PortalSetup from './components/PortalSetup';
import PortalWorkspace from './components/PortalWorkspace';
import PortalHeader from './components/PortalHeader';
import { isDarkPreviewRoute, stripDarkPreviewPrefix } from './routePaths';

/**
 * After route changes, scroll like “Back to top” links: smooth `scrollIntoView` on `#page-top`
 * without mutating the URL hash. Skips when the URL already targets another in-page section.
 */
function ScrollToTopOnRouteChange() {
    const { pathname, hash } = useLocation();
    useLayoutEffect(() => {
        if (hash && hash !== '#page-top') return undefined;
        const raf = requestAnimationFrame(() => {
            scrollToHashAnchor('#page-top', { updateHistory: false });
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
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/accessibility" element={<Accessibility />} />
            <Route path="/portal" element={<PortalSetup />} />
            <Route path="/portal/tenant" element={<PortalWorkspace role="tenant" />} />
            <Route path="/portal/landlord" element={<PortalWorkspace role="landlord" />} />
            <Route path="/portal/admin" element={<PortalWorkspace role="admin" />} />
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

const App = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const strippedPath = stripDarkPreviewPrefix(location.pathname);
    const isPortalShell = strippedPath.startsWith('/portal');
    return (
        <AppShell>
            <ScrollToTopOnRouteChange />
            <a href="#main-content" className="sr-only sr-only-focusable">
                {t('skipToMain')}
            </a>
            <ResponsiveNavbar />
            {isPortalShell && <PortalHeader />}
            <Container id="main-content">
                <AppRoutes />
            </Container>
            <Footer />
            <Analytics />
        </AppShell>
    );
};

export default App;
