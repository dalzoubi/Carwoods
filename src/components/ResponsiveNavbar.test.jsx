import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from '../ThemeModeContext';
import { LanguageProvider } from '../LanguageContext';
import { PortalAuthProvider } from '../PortalAuthContext';
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
          <PortalAuthProvider>
            <ResponsiveNavbar />
          </PortalAuthProvider>
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
    // Logo link and nav text link both have aria-label/text "Home"; confirm at least one exists.
    expect(screen.getAllByRole('link', { name: /^home$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
  });

  it('renders Tenant dropdown with Apply, Selection Criteria, Required Documents', () => {
    renderWithProviders(<ResponsiveNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /renters menu/i }));
    expect(screen.getByRole('menuitem', { name: /^apply$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /selection criteria/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /required documents/i })).toBeInTheDocument();
  });

  it('renders For Landlords dropdown with product links', () => {
    renderWithProviders(<ResponsiveNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /for landlords menu/i }));
    expect(screen.getByRole('menuitem', { name: /for property managers/i })).toBeInTheDocument();
  });

  it('renders Sign in in the toolbar to start portal authentication', () => {
    renderWithProviders(<ResponsiveNavbar />);
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
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

  describe('Mobile drawer layout', () => {
    const mockMobile = () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('max-width'),
        media: query,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    };

    const openDrawer = () => {
      fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    };

    const getDrawer = () => screen.getByRole('navigation', { name: /site menu/i });

    it('renders Get Started CTA and Sign In in the auth zone when unauthenticated', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      const getStarted = within(drawer).getByRole('link', { name: /get started/i });
      expect(getStarted).toHaveAttribute('href', '/pricing');
      expect(within(drawer).getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('defaults audience tabs to Renters and lists renter links in its panel', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      const rentersTab = within(drawer).getByRole('tab', { name: /^renters$/i });
      expect(rentersTab).toHaveAttribute('aria-selected', 'true');
      const panel = within(drawer).getByRole('region', { name: /^renters$/i });
      expect(within(panel).getByRole('link', { name: /^apply$/i })).toBeInTheDocument();
      expect(within(panel).getByRole('link', { name: /selection criteria/i })).toBeInTheDocument();
    });

    it('switches to landlord links when the Landlords tab is activated', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      fireEvent.click(within(drawer).getByRole('tab', { name: /for landlords/i }));
      const panel = within(drawer).getByRole('region', { name: /for landlords/i });
      expect(within(panel).getByRole('link', { name: /for property managers/i })).toBeInTheDocument();
      expect(within(panel).getByRole('link', { name: /pricing/i })).toBeInTheDocument();
    });

    it('pre-selects the Landlords tab when opened on a landlord-audience route', () => {
      mockMobile();
      renderNavAt('/pricing');
      openDrawer();
      const drawer = getDrawer();
      expect(within(drawer).getByRole('tab', { name: /for landlords/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('renders core links (Home, Property Management, Contact Us) outside the audience panel', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      expect(within(drawer).getByRole('link', { name: /^home$/i })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: /property management/i })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: /contact us/i })).toBeInTheDocument();
    });

    it('shows the current language label in the footer language row', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      const languageRow = within(drawer).getByRole('button', { name: /language/i });
      expect(within(languageRow).getByText(/english/i)).toBeInTheDocument();
    });

    it('keeps Legal collapsed by default and expands it on click', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      const toggle = within(drawer).getByRole('button', { name: /legal links/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(within(drawer).queryByRole('link', { name: /privacy policy/i })).not.toBeInTheDocument();
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(within(drawer).getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: /terms of service/i })).toBeInTheDocument();
    });
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

    it('does not mark any list language as selected when following browser language', () => {
      renderWithProviders(<ResponsiveNavbar />);
      fireEvent.click(screen.getByRole('button', { name: /select language/i }));
      for (const name of [/english/i, /español/i, /français/i, /العربية/i]) {
        expect(screen.getByRole('menuitem', { name })).not.toHaveClass('Mui-selected');
      }
    });

    it('marks only the stored override language as selected in the menu', async () => {
      localStorage.setItem('carwoods-language', 'fr');
      await i18n.changeLanguage('fr');
      renderWithProviders(<ResponsiveNavbar />);
      fireEvent.click(screen.getByRole('button', { name: /select language|sélectionner la langue|seleccionar idioma|اختر اللغة/i }));
      expect(screen.getByRole('menuitem', { name: /français/i })).toHaveClass('Mui-selected');
      expect(screen.getByRole('menuitem', { name: /english/i })).not.toHaveClass('Mui-selected');
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
