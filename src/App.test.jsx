import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { ThemeModeProvider } from './ThemeModeContext';
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
    expect(screen.getByRole('heading', { name: /where houston finds home/i })).toBeInTheDocument();
  });

  it('serves home at /dark and shows dark preview in appearance menu', () => {
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
      <MemoryRouter initialEntries={['/dark']}>
        <ThemeModeProvider>
          <App />
        </ThemeModeProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /where houston finds home/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /appearance and theme/i }));
    expect(screen.getByText(/dark preview/i)).toBeInTheDocument();
  });
});
