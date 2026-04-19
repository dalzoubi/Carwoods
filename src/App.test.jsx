import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { ThemeModeProvider } from './ThemeModeContext';
import { LanguageProvider } from './LanguageContext';
import { PortalAuthProvider } from './PortalAuthContext';
import { WithAppTheme } from './testUtils';

const renderWithProviders = (ui) => render(
  <WithAppTheme>{ui}</WithAppTheme>
);

describe('App', () => {
  it('renders navbar and footer', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: !query.includes('max-width'),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    renderWithProviders(<App />);
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders Home content at root path', () => {
    renderWithProviders(<App />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /property management in houston\. self-management anywhere\./i,
      })
    ).toBeInTheDocument();
  });

  it('serves apply at /dark/apply and opens appearance menu', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: !query.includes('max-width'),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/dark/apply']}>
          <LanguageProvider>
            <ThemeModeProvider>
              <PortalAuthProvider>
                <App />
              </PortalAuthProvider>
            </ThemeModeProvider>
          </LanguageProvider>
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(screen.getByRole('heading', { name: /how to apply to rent/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /appearance and theme/i }));
    expect(screen.getByText(/^color theme$/i)).toBeInTheDocument();
  });
});
