import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from '../ThemeModeContext';
import { WithAppTheme } from '../testUtils';
import ResponsiveNavbar from './ResponsiveNavbar';

const renderWithProviders = (ui) => render(
  <WithAppTheme>{ui}</WithAppTheme>
);

const renderNavAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeModeProvider>
        <ResponsiveNavbar />
      </ThemeModeProvider>
    </MemoryRouter>
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
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  describe('Print control', () => {
    it('renders print on tenant selection criteria', () => {
      renderNavAt('/tenant-selection-criteria');
      expect(screen.getByRole('button', { name: /print this page/i })).toBeInTheDocument();
    });

    it('renders print on required documents and property management', () => {
      const { unmount } = renderNavAt('/application-required-documents');
      expect(screen.getByRole('button', { name: /print this page/i })).toBeInTheDocument();
      unmount();
      renderNavAt('/property-management');
      expect(screen.getByRole('button', { name: /print this page/i })).toBeInTheDocument();
    });

    it('renders print under dark preview path', () => {
      renderNavAt('/dark/tenant-selection-criteria');
      expect(screen.getByRole('button', { name: /print this page/i })).toBeInTheDocument();
    });

    it('does not render print on home', () => {
      renderNavAt('/');
      expect(screen.queryByRole('button', { name: /print this page/i })).not.toBeInTheDocument();
    });

    it('calls window.print when print is clicked', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      renderNavAt('/property-management');
      fireEvent.click(screen.getByRole('button', { name: /print this page/i }));
      expect(printSpy).toHaveBeenCalledTimes(1);
      printSpy.mockRestore();
    });
  });
});
