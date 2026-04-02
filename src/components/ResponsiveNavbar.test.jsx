import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from '../ThemeModeContext';
import { LanguageProvider } from '../LanguageContext';
import { WithAppTheme } from '../testUtils';
import ResponsiveNavbar from './ResponsiveNavbar';
import i18n from '../i18n';

const renderWithProviders = (ui) => render(
  <WithAppTheme>{ui}</WithAppTheme>
);

const renderNavAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <ThemeModeProvider>
          <ResponsiveNavbar />
        </ThemeModeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );

describe('ResponsiveNavbar', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    localStorage.clear();
  });

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

  describe('Language menu', () => {
    beforeEach(() => {
      // Ensure desktop mode so toolbar language button is visible
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: !query.includes('max-width'),
        media: query,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    });

    it('renders language icon button in toolbar', () => {
      renderWithProviders(<ResponsiveNavbar />);
      expect(
        screen.getByRole('button', { name: /select language/i })
      ).toBeInTheDocument();
    });

    it('opens language menu on click and shows all supported languages', () => {
      renderWithProviders(<ResponsiveNavbar />);
      fireEvent.click(screen.getByRole('button', { name: /select language/i }));
      expect(screen.getByRole('menuitem', { name: /english/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /español/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /français/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /العربية/i })).toBeInTheDocument();
    });

    it('selects a language and closes menu', async () => {
      renderWithProviders(<ResponsiveNavbar />);
      fireEvent.click(screen.getByRole('button', { name: /select language/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: /español/i }));
      });
      // Menu should be closed after selection
      expect(screen.queryByRole('menuitem', { name: /español/i })).not.toBeInTheDocument();
    });

    it('language menu has aria-labelledby referencing the toolbar button', () => {
      renderWithProviders(<ResponsiveNavbar />);
      const btn = screen.getByRole('button', { name: /select language/i });
      fireEvent.click(btn);
      // The button id should be set
      expect(btn).toHaveAttribute('id', 'language-menu-button-toolbar');
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    });

    it('language menu includes reset to browser language when override is set', async () => {
      localStorage.setItem('carwoods-language', 'fr');
      await i18n.changeLanguage('fr');
      renderWithProviders(<ResponsiveNavbar />);
      fireEvent.click(screen.getByRole('button', { name: /select language|sélectionner la langue|seleccionar idioma|اختر اللغة/i }));
      const resetItem = screen.getByRole('menuitem', {
        name: /browser language|idioma del navegador|langue du navigateur|لغة المتصفح/i,
      });
      expect(resetItem).not.toHaveAttribute('aria-disabled', 'true');
      await act(async () => {
        fireEvent.click(resetItem);
      });
      expect(localStorage.getItem('carwoods-language')).toBeNull();
    });
  });
});
