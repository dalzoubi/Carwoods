import React, { useEffect, useLayoutEffect, useMemo, Suspense, lazy } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { AppShell, Container, Content, scrollToHashAnchor } from './styles';
import Home from './components/Home';
import Apply from './components/Apply';
import TenantSelectionCriteria from './components/TenantSelectionCriteria';
import ApplicationRequiredDocuments from './components/ApplicationRequiredDocuments';
import PropertyManagement from './components/PropertyManagement';
import SelfManagedLandlords from './components/SelfManagedLandlords';
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
import PortalLayout from './components/PortalLayout';
import PortalAuthGate from './components/PortalAuthGate';
import { PortalRequestDetailModalProvider } from './components/PortalRequestDetailModalContext';
import PortalRouteGuard from './components/PortalRouteGuard';
import { isDarkPreviewRoute, isPortalRoute } from './routePaths';
import { Role } from './domain/constants';
import { useProfilePreferenceSync } from './hooks/useProfilePreferenceSync';

const PortalDashboard = lazy(() => import('./components/PortalDashboard'));
const PortalStatus = lazy(() => import('./components/PortalStatus'));
const PortalProfile = lazy(() => import('./components/PortalProfile'));
const PortalRequests = lazy(() => import('./components/PortalRequests'));
const PortalDocuments = lazy(() => import('./components/PortalDocuments'));
const PortalAdminLandlords = lazy(() => import('./components/PortalAdminLandlords'));
const PortalAdminUsers = lazy(() => import('./components/PortalAdminUsers'));
const PortalNotificationsInbox = lazy(() => import('./components/PortalNotificationsInbox'));
const PortalInbox = lazy(() => import('./components/PortalInbox'));
const PortalInboxContactGate = lazy(() =>
    import('./components/PortalInbox').then((m) => ({ default: m.PortalInboxContactGate }))
);
const RedirectLegacyContactRequestsToInbox = lazy(() =>
    import('./components/PortalInbox').then((m) => ({ default: m.RedirectLegacyContactRequestsToInbox }))
);
const RedirectPortalNotificationsToInbox = lazy(() =>
    import('./components/PortalInbox').then((m) => ({ default: m.RedirectPortalNotificationsToInbox }))
);
const PortalAdminAiSettings = lazy(() => import('./components/PortalAdminAiSettings'));
const PortalAdminNotificationReport = lazy(() => import('./components/PortalAdminNotificationReport'));
const PortalAdminCostReport = lazy(() => import('./components/PortalAdminCostReport'));
const PortalAdminProperties = lazy(() => import('./components/PortalAdminProperties'));
const PortalPayments = lazy(() => import('./components/PortalPayments'));
const PortalMyLease = lazy(() => import('./components/PortalMyLease'));
const PortalLandlordNotices = lazy(() => import('./components/PortalLandlordNotices'));
const PortalTenants = lazy(() => import('./components/PortalTenants'));
const PortalSupportTickets = lazy(() => import('./components/PortalSupportTickets'));
const PortalAdminSupport = lazy(() => import('./components/PortalAdminSupport'));
const PortalAdminNotificationTest = lazy(() => import('./components/PortalAdminNotificationTest'));

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
            <Route path="/self-managed-landlords" element={<SelfManagedLandlords />} />
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
                path="/portal/my-lease"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT]}>
                        <PortalMyLease />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/notices"
                element={
                    <PortalRouteGuard allowedRoles={[Role.LANDLORD, Role.ADMIN]}>
                        <PortalLandlordNotices />
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
                path="/portal/admin/users"
                element={
                    <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
                        <PortalAdminUsers />
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
                path="/portal/admin/reports/notifications"
                element={
                    <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
                        <PortalAdminNotificationReport />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/admin/reports/costs"
                element={
                    <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
                        <PortalAdminCostReport />
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
            <Route
                path="/portal/support"
                element={
                    <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
                        <PortalSupportTickets />
                    </PortalRouteGuard>
                }
            />
            <Route
                path="/portal/admin/support"
                element={
                    <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
                        <PortalAdminSupport />
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

function PortalRouteFallback() {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress aria-label={t('portalLoading.ariaLabel')} />
        </Box>
    );
}

function PortalApp() {
    return (
        <>
            <ScrollToTopOnRouteChange />
            <PortalAuthGate>
                <PortalRequestDetailModalProvider>
                    <PortalLayout>
                        <Suspense fallback={<PortalRouteFallback />}>
                            <PortalRoutes />
                        </Suspense>
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
