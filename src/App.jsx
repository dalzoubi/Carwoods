import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell, Container, Content, scrollToHashAnchor } from './styles';
import Home from './components/Home';
import Apply from './components/Apply';
import TenantSelectionCriteria from './components/TenantSelectionCriteria';
import ApplicationRequiredDocuments from './components/ApplicationRequiredDocuments';
import PropertyManagement from './components/PropertyManagement';
import Pricing from './components/Pricing';
import Features from './components/Features';
import ForPropertyManagers from './components/ForPropertyManagers';
import ContactUs from './components/ContactUs';
import Privacy from './components/Privacy';
import Accessibility from './components/Accessibility';
import TermsOfService from './components/TermsOfService';
import PublicDocumentShare from './components/PublicDocumentShare';
import Footer from './components/Footer';
import ResponsiveNavbar from './components/ResponsiveNavbar';
import PortalDashboard from './components/PortalDashboard';
import PortalStatus from './components/PortalStatus';
import PortalProfile from './components/PortalProfile';
import PortalRequests from './components/PortalRequests';
import PortalDocuments from './components/PortalDocuments';
import PortalAdminLandlords from './components/PortalAdminLandlords';
import PortalNotificationsInbox from './components/PortalNotificationsInbox';
import PortalInbox, {
    PortalInboxContactGate,
    RedirectLegacyContactRequestsToInbox,
    RedirectPortalNotificationsToInbox,
} from './components/PortalInbox';
import PortalAdminAiSettings from './components/PortalAdminAiSettings';
import PortalAdminProperties from './components/PortalAdminProperties';
import PortalPayments from './components/PortalPayments';
import PortalTenants from './components/PortalTenants';
import PortalAdminNotificationTest from './components/PortalAdminNotificationTest';
import PortalLayout from './components/PortalLayout';
import PortalAuthGate from './components/PortalAuthGate';
import { PortalRequestDetailModalProvider } from './components/PortalRequestDetailModalContext';
import PortalRouteGuard from './components/PortalRouteGuard';
import { isDarkPreviewRoute, isPortalRoute } from './routePaths';
import { Role } from './domain/constants';
import { useProfilePreferenceSync } from './hooks/useProfilePreferenceSync';

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

function useDarkStrippedLocation() {
    const location = useLocation();
    const matchPathname = useMemo(() => {
        const p = location.pathname;
        if (isDarkPreviewRoute(p)) {
            if (p === '/dark') return '/';
            return p.slice('/dark'.length) || '/';
        }
        return p;
    }, [location.pathname]);

    return useMemo(
        () => ({ ...location, pathname: matchPathname }),
        [location, matchPathname]
    );
}

function MarketingRoutes() {
    const routesLocation = useDarkStrippedLocation();
    return (
        <Routes location={routesLocation}>
            <Route path="/" element={<Home />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/tenant-selection-criteria" element={<TenantSelectionCriteria />} />
            <Route path="/application-required-documents" element={<ApplicationRequiredDocuments />} />
            <Route path="/property-management" element={<PropertyManagement />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/for-property-managers" element={<ForPropertyManagers />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/accessibility" element={<Accessibility />} />
            <Route path="/d/:token" element={<PublicDocumentShare />} />
            <Route path="/shared-documents/:token" element={<PublicDocumentShare />} />
        </Routes>
    );
}

function PortalRoutes() {
    const routesLocation = useDarkStrippedLocation();
    return (
        <Routes location={routesLocation}>
            <Route path="/portal" element={<PortalDashboard />} />
            <Route
                path="/portal/status"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalStatus />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/profile"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalProfile />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/requests"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalRequests />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/documents"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalDocuments />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/payments"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalPayments />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/notifications"
                element={<RedirectPortalNotificationsToInbox />}
            />
            <Route
                path="/portal/inbox"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalInbox />
                    </PortalRouteGuard>
                }
            >
                <Route index element={<Navigate to="requests" replace />} />
                <Route path="requests" element={<PortalRequests />} />
                <Route path="notifications" element={<PortalNotificationsInbox />} />
                <Route path="contact" element={<PortalInboxContactGate />} />
            </Route>
            <Route
                path="/portal/admin"
                element={<Navigate to="/portal/admin/config" replace />}
            />
            <Route
                path="/portal/admin/landlords"
                element={
                    <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
                        <PortalAdminLandlords />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/admin/contact-requests"
                element={<RedirectLegacyContactRequestsToInbox />}
            />
            <Route
                path="/portal/admin/ai"
                element={<Navigate to="/portal/admin/config" replace />}
            />
            <Route
                path="/portal/admin/config"
                element={
                    <PortalRouteGuard allowedRoles={[Role.LANDLORD, Role.ADMIN]}>
                        <PortalAdminAiSettings />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/admin/health/notification-test"
                element={
                    <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
                        <PortalAdminNotificationTest />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/properties"
                element={
                    <PortalRouteGuard allowedRoles={[Role.LANDLORD, Role.ADMIN]}>
                        <PortalAdminProperties />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/tenants"
                element={
                    <PortalRouteGuard allowedRoles={[Role.LANDLORD, Role.ADMIN]}>
                        <PortalTenants />
                    </PortalRouteGuard>
                }
            />
            <Route path="/portal/tenant" element={<Navigate to="/portal" replace />} />
            <Route path="/portal/landlord" element={<Navigate to="/portal" replace />} />
        </Routes>
    );
}

function MarketingApp() {
    const { t } = useTranslation();
    const location = useLocation();
    return (
        <AppShell>
            <ScrollToTopOnRouteChange />
            <a href="#main-content" className="sr-only sr-only-focusable">
                {t('skipToMain')}
            </a>
            <ResponsiveNavbar />
            <Container id="main-content">
                <Content key={location.pathname}>
                    <span id="page-top" />
                    <MarketingRoutes />
                </Content>
            </Container>
            <Footer />
            <Analytics />
            <SpeedInsights />
        </AppShell>
    );
}

function PortalApp() {
    return (
        <>
            <ScrollToTopOnRouteChange />
            <PortalAuthGate>
                <PortalRequestDetailModalProvider>
                    <PortalLayout>
                        <PortalRoutes />
                    </PortalLayout>
                </PortalRequestDetailModalProvider>
            </PortalAuthGate>
            <Analytics />
            <SpeedInsights />
        </>
    );
}

const App = () => {
    const location = useLocation();
    const isPortal = isPortalRoute(location.pathname);
    useProfilePreferenceSync();

    useEffect(() => {
        document.dispatchEvent(new Event('prerender-ready'));
    }, []);

    return isPortal ? <PortalApp /> : <MarketingApp />;
};

export default App;
