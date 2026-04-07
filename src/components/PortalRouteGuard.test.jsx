import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeModeProvider } from '../ThemeModeContext';
import { LanguageProvider } from '../LanguageContext';
import i18n from '../i18n';
import PortalRouteGuard from './PortalRouteGuard';
import { Role } from '../domain/constants';

// Mutable auth state shared across tests.
const authState = {
  isAuthenticated: true,
  account: { name: 'Test User' },
  meData: null,
  meStatus: 'ok',
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => authState,
  PortalAuthProvider: ({ children }) => children,
}));

/** Captures the location.state of whatever route ultimately renders. */
function LocationStateSpy() {
  const { state } = useLocation();
  return <div data-testid="location-state">{JSON.stringify(state)}</div>;
}

function renderWithRouter(ui, { initialPath = '/portal/admin' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LanguageProvider>
        <ThemeModeProvider>
          {ui}
        </ThemeModeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('PortalRouteGuard', () => {
  beforeEach(async () => {
    authState.isAuthenticated = true;
    authState.account = { name: 'Test User' };
    authState.meData = null;
    authState.meStatus = 'ok';
    await i18n.changeLanguage('en');
  });

  it('renders children when role is allowed', () => {
    authState.meData = { user: { role: Role.ADMIN, status: 'ACTIVE' } };

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/admin"
          element={
            <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
              <div>Admin content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('redirects to /portal when role is not in allowedRoles', () => {
    authState.meData = { user: { role: Role.TENANT, status: 'ACTIVE' } };

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/admin"
          element={
            <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
              <div>Admin content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redirects to /portal when user has no role (guest)', () => {
    authState.meData = null;

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/profile"
          element={
            <PortalRouteGuard allowedRoles={[Role.TENANT, Role.LANDLORD, Role.ADMIN]}>
              <div>Profile content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>,
      { initialPath: '/portal/profile' }
    );

    expect(screen.queryByText('Profile content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('passes portalAccessDenied=true in location state when redirecting', () => {
    authState.meData = { user: { role: Role.TENANT, status: 'ACTIVE' } };

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/admin"
          element={
            <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
              <div>Admin content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<LocationStateSpy />} />
      </Routes>
    );

    const spy = screen.getByTestId('location-state');
    const state = JSON.parse(spy.textContent);
    expect(state?.portalAccessDenied).toBe(true);
  });

  it('renders children (no redirect) while /me is still loading', () => {
    authState.meData = null;
    authState.meStatus = 'loading';

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/admin"
          element={
            <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
              <div>Admin content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>
    );

    // Guard passes children through while /me is loading.
    expect(screen.getByText('Admin content')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders children (no redirect) when meStatus is idle', () => {
    authState.meData = null;
    authState.meStatus = 'idle';

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/admin"
          element={
            <PortalRouteGuard allowedRoles={[Role.ADMIN]}>
              <div>Admin content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('supports a custom allow predicate', () => {
    authState.meData = { user: { role: Role.LANDLORD, status: 'ACTIVE' } };

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/properties"
          element={
            <PortalRouteGuard allow={(role) => role === Role.LANDLORD || role === Role.ADMIN}>
              <div>Properties content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>,
      { initialPath: '/portal/properties' }
    );

    expect(screen.getByText('Properties content')).toBeInTheDocument();
  });

  it('redirects via custom allow predicate when role does not match', () => {
    authState.meData = { user: { role: Role.TENANT, status: 'ACTIVE' } };

    renderWithRouter(
      <Routes>
        <Route
          path="/portal/properties"
          element={
            <PortalRouteGuard allow={(role) => role === Role.LANDLORD || role === Role.ADMIN}>
              <div>Properties content</div>
            </PortalRouteGuard>
          }
        />
        <Route path="/portal" element={<div>Dashboard</div>} />
      </Routes>,
      { initialPath: '/portal/properties' }
    );

    expect(screen.queryByText('Properties content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
