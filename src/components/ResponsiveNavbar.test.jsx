import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WithAppTheme } from '../testUtils';
import ResponsiveNavbar from './ResponsiveNavbar';

const renderWithProviders = (ui) => render(
  <WithAppTheme>
    <BrowserRouter>{ui}</BrowserRouter>
  </WithAppTheme>
);

describe('ResponsiveNavbar', () => {
  it('renders logo with alt text', () => {
    renderWithProviders(<ResponsiveNavbar />);
    expect(screen.getByAltText('Carwoods')).toBeInTheDocument();
  });

  it('renders Home and Contact Us links', () => {
    renderWithProviders(<ResponsiveNavbar />);
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
  });

  it('renders Tenant dropdown with Apply, Selection Criteria, Required Documents', () => {
    renderWithProviders(<ResponsiveNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /tenant menu/i }));
    expect(screen.getByRole('menuitem', { name: /^apply$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /selection criteria/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /required documents/i })).toBeInTheDocument();
  });

  it('renders Landlord dropdown with Property Management', () => {
    renderWithProviders(<ResponsiveNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /landlord menu/i }));
    expect(screen.getByRole('menuitem', { name: /property management/i })).toBeInTheDocument();
  });

  it('has accessible menu button on mobile', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('max-width'),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    renderWithProviders(<ResponsiveNavbar />);
    const menuButton = screen.getByRole('button', { name: /open drawer/i });
    expect(menuButton).toBeInTheDocument();
  });
});
