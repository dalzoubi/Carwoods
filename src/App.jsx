import React, { useLayoutEffect, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
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
import PortalProfile from './components/PortalProfile';
import PortalRequests from './components/PortalRequests';
import { isDarkPreviewRoute } from './routePaths';

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
            <Route path="/portal/workspace" element={<PortalWorkspace />} />
            <Route path="/portal/profile" element={<PortalProfile />} />
            <Route path="/portal/requests" element={<PortalRequests />} />
            <Route path="/portal/tenant" element={<Navigate to="/portal/workspace" replace />} />
            <Route path="/portal/landlord" element={<Navigate to="/portal/workspace" replace />} />
            <Route path="/portal/admin" element={<Navigate to="/portal/workspace" replace />} />
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
    return (
        <AppShell>
            <ScrollToTopOnRouteChange />
            <a href="#main-content" className="sr-only sr-only-focusable">
                {t('skipToMain')}
            </a>
            <ResponsiveNavbar />
            <Container id="main-content">
                <AppRoutes />
            </Container>
            <Footer />
            <Analytics />
        </AppShell>
    );
};

export default App;
