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

  it('renders Owners dropdown with product links', () => {
    renderWithProviders(<ResponsiveNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /owners menu/i }));
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

    it('renders Get Started CTA and Sign In in the sticky footer when unauthenticated', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      // Sticky footer lives outside the scrollable <nav> region but inside the drawer paper.
      const drawerPaper = document.getElementById('main-navigation-drawer');
      expect(drawerPaper).not.toBeNull();
      const getStarted = within(drawerPaper).getByRole('link', { name: /get started/i });
      expect(getStarted).toHaveAttribute('href', '/pricing');
      expect(within(drawerPaper).getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      // Confirm the CTA is NOT inside the scrollable <nav> region.
      expect(within(drawer).queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
    });

    it('lists renter links under a For Renters section', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      // Section-labeled list exposes its subheader as the list's accessible name.
      const rentersList = within(drawer).getByRole('list', { name: /^renters$/i });
      expect(within(rentersList).getByRole('link', { name: /^apply$/i })).toBeInTheDocument();
      expect(within(rentersList).getByRole('link', { name: /selection criteria/i })).toBeInTheDocument();
      expect(within(rentersList).getByRole('link', { name: /required documents/i })).toBeInTheDocument();
    });

    it('highlights Self-Managed and Full-Service as prominent choices in the landlord section', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      const landlordList = within(drawer).getByRole('list', { name: /owners/i });
      const selfManaged = within(landlordList).getByRole('link', { name: /self-managed landlords/i });
      const fullService = within(landlordList).getByRole('link', { name: /full-service property management/i });
      expect(selfManaged).toHaveAttribute('href', '/self-managed-landlords');
      expect(fullService).toHaveAttribute('href', '/property-management');
      // Taglines are rendered as secondary text on the choice cards.
      expect(within(selfManaged).getByText(/keep control/i)).toBeInTheDocument();
      expect(within(fullService).getByText(/hands-off/i)).toBeInTheDocument();
      // Supporting links still present.
      expect(within(landlordList).getByRole('link', { name: /for property managers/i })).toBeInTheDocument();
      expect(within(landlordList).getByRole('link', { name: /pricing/i })).toBeInTheDocument();
    });

    it('renders Home and Contact Us as top-level rows', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      expect(within(drawer).getByRole('link', { name: /^home$/i })).toBeInTheDocument();
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

    it('renders Legal links inline (Privacy, Terms, Accessibility) without a collapsible toggle', () => {
      mockMobile();
      renderWithProviders(<ResponsiveNavbar />);
      openDrawer();
      const drawer = getDrawer();
      expect(within(drawer).queryByRole('button', { name: /legal links/i })).not.toBeInTheDocument();
      const legalList = within(drawer).getByRole('list', { name: /^legal$/i });
      expect(within(legalList).getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
      expect(within(legalList).getByRole('link', { name: /terms of service/i })).toBeInTheDocument();
      expect(within(legalList).getByRole('link', { name: /accessibility/i })).toBeInTheDocument();
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
