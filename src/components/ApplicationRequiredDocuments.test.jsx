import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ApplicationRequiredDocuments from './ApplicationRequiredDocuments';

const STORAGE_KEY = 'carwoods_applicant_profile';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

const renderWithHash = (hash) => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash },
  });
  return renderWithRouter(<ApplicationRequiredDocuments />);
};

const renderWithProfile = (profile) => {
  if (profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }
  return renderWithRouter(<ApplicationRequiredDocuments />);
};

describe('ApplicationRequiredDocuments', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('renders heading', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByRole('heading', { name: /application required documents/i })).toBeInTheDocument();
  });

  describe('Print button', () => {
    it('renders a print button', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('button', { name: /print this page/i })).toBeInTheDocument();
    });

    it('calls window.print when the print button is clicked', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      renderWithRouter(<ApplicationRequiredDocuments />);
      fireEvent.click(screen.getByRole('button', { name: /print this page/i }));
      expect(printSpy).toHaveBeenCalledTimes(1);
      printSpy.mockRestore();
    });
  });

  it('contains fair housing statement', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByText(/we do not discriminate based on race, color, religion, sex, familial status/i)).toBeInTheDocument();
  });

  it('links to tenant selection criteria', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    const links = screen.getAllByRole('link', { name: /tenant selection criteria/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/tenant-selection-criteria');
  });

  it('lists personal identification requirement', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByText(/personal identification.*all adults 18\+/i)).toBeInTheDocument();
  });

  it('lists Section 8 requirements', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByText(/section 8.*housing assistance applicants/i)).toBeInTheDocument();
  });

  describe('Table of contents', () => {
    it('renders the table of contents navigation', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument();
    });

    it('uses alphabetic (a, b, c) numbering for sub-lists in table of contents', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const nav = container.querySelector('nav[aria-label="Table of contents"]');
      const alphaLists = nav.querySelectorAll('ol[type="a"]');
      expect(alphaLists.length).toBeGreaterThanOrEqual(2);
    });

    it('uses alphabetic (a, b, c) numbering in Pets and Benefits content sections', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const petsSection = container.querySelector('#pets-animals');
      const benefitsSection = container.querySelector('#benefits');
      expect(petsSection.querySelector('ol[type="a"]')).not.toBeNull();
      expect(benefitsSection.querySelector('ol[type="a"]')).not.toBeNull();
    });

    it('links to the personal identification section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /personal identification/i })).toHaveAttribute('href', '#identification');
    });

    it('links to the employed section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^if employed$/i })).toHaveAttribute('href', '#employed');
    });

    it('links to the self-employed section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^if self-employed$/i })).toHaveAttribute('href', '#self-employed');
    });

    it('links to the rental history section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /rental history/i })).toHaveAttribute('href', '#rental-history');
    });

    it('links to the pets and assistance animals section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^pets and assistance animals$/i })).toHaveAttribute('href', '#pets-animals');
    });

    it('links to the pets subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^pets$/i })).toHaveAttribute('href', '#pets-only');
    });

    it('links to the service animals subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^service animals$/i })).toHaveAttribute('href', '#service-animals');
    });

    it('links to the ESA subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /emotional support animals/i })).toHaveAttribute('href', '#esa');
    });

    it('links to the benefits section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /government or other benefits/i })).toHaveAttribute('href', '#benefits');
    });

    it('links to the VA benefits subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^va benefits$/i })).toHaveAttribute('href', '#va-benefits');
    });

    it('links to the SSA/SSI subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /ssa \/ ssi/i })).toHaveAttribute('href', '#ssa-ssi');
    });

    it('links to the SSDI subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^ssdi$/i })).toHaveAttribute('href', '#ssdi');
    });

    it('links to the retirement/pension subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /retirement \/ pension/i })).toHaveAttribute('href', '#retirement');
    });

    it('links to the child support subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /child support or spousal maintenance/i })).toHaveAttribute('href', '#child-support');
    });

    it('links to the all other benefits subsection', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^all other benefits$/i })).toHaveAttribute('href', '#other-benefits');
    });

    it('links to the emergency contact section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /emergency contact/i })).toHaveAttribute('href', '#emergency-contact');
    });

    it('links to the Section 8 section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /section 8 \/ housing assistance/i })).toHaveAttribute('href', '#section-8');
    });

    it('links to the guarantor section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^guarantor$/i })).toHaveAttribute('href', '#guarantor');
    });

    it('links to the co-signer section', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('link', { name: /^co-signer$/i })).toHaveAttribute('href', '#cosigner');
    });
  });

  describe('Pets and Assistance Animals section', () => {
    it('renders the Pets and Assistance Animals section heading', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByRole('heading', { name: /pets and assistance animals/i })).toBeInTheDocument();
    });

    it('describes service animal task inquiry without requiring certification', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/what specific task or work the animal has been trained to perform/i)).toBeInTheDocument();
    });

    it('states no pet deposit may be charged for a service animal', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      const noDepositItems = screen.getAllByText(/no pet deposit, pet fee, or pet rent may be charged/i);
      expect(noDepositItems.length).toBeGreaterThanOrEqual(1);
    });

    it('requires ESA letter to be on official letterhead with license info', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/written on the provider's official letterhead/i)).toBeInTheDocument();
      expect(screen.getByText(/license type, license number, state of licensure/i)).toBeInTheDocument();
    });

    it('requires ESA letter to be dated within the past 12 months', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      const freshnessItems = screen.getAllByText(/dated within the past/i);
      expect(freshnessItems.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects online certificates and registry IDs for assistance animals', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/online certificates, registry ids, vest documentation/i)).toBeInTheDocument();
    });
  });

  describe('Government and Other Benefits section', () => {
    it('renders the benefits section heading', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/applicants receiving government or other benefits/i)).toBeInTheDocument();
    });

    it('lists VA benefits documentation requirements', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/va \(veterans affairs\) benefits/i)).toBeInTheDocument();
      expect(screen.getByText(/current va benefits award letter/i)).toBeInTheDocument();
    });

    it('lists Social Security and SSI documentation requirements', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/social security \(ssa\) or supplemental security income \(ssi\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ssa award letter or benefit verification letter/i)).toBeInTheDocument();
    });

    it('lists SSDI documentation requirements', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/social security disability insurance \(ssdi\)/i)).toBeInTheDocument();
      expect(screen.getByText(/current ssdi award letter/i)).toBeInTheDocument();
    });

    it('lists retirement and pension income requirements', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/retirement \/ pension income/i)).toBeInTheDocument();
      expect(screen.getByText(/tcdrs, trs, fers, or private pension/i)).toBeInTheDocument();
    });

    it('lists child support and spousal maintenance requirements', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getAllByText(/child support or spousal maintenance/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/court order or divorce decree/i)).toBeInTheDocument();
      expect(screen.getByText(/oag.*texas office of the attorney general/i)).toBeInTheDocument();
    });

    it('covers all other benefits with a catch-all requirement', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getAllByText(/all other benefits/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/official award or benefit letter from the issuing agency/i)).toBeInTheDocument();
    });
  });

  describe('Guarantor section', () => {
    it('renders the guarantor section heading', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/if a guarantor is required/i)).toBeInTheDocument();
    });

    it('clarifies a guarantor signs a separate guaranty agreement, not the lease', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/signs a separate guaranty agreement \(not the lease\)/i)).toBeInTheDocument();
    });

    it('lists signed guaranty agreement as a required guarantor document', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/signed guaranty agreement/i)).toBeInTheDocument();
    });

    it('requires 24 months of landlord references', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const guarantorSection = container.querySelector('#guarantor');
      expect(guarantorSection.textContent).toMatch(/landlord reference information for the past/i);
    });

    it('requires 24 months of mortgage payment history if no rental history', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const guarantorSection = container.querySelector('#guarantor');
      expect(guarantorSection.textContent).toMatch(/no rental history but paying a mortgage/i);
      expect(guarantorSection.textContent).toMatch(/24 months.*mortgage payment history/i);
    });
  });

  describe('Co-signer section', () => {
    it('renders the co-signer section heading', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/if a co-signer is required/i)).toBeInTheDocument();
    });

    it('distinguishes co-signer from guarantor', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/not the same as a guarantor/i)).toBeInTheDocument();
    });

    it('states co-signer is jointly and severally liable from day one', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/jointly and severally liable for all lease obligations from day one/i)).toBeInTheDocument();
    });

    it('requires co-signer to provide 24 months of landlord references', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const cosignerSection = container.querySelector('#cosigner');
      expect(cosignerSection.textContent).toMatch(/landlord reference information for the past/i);
    });

    it('requires 24 months of mortgage payment history if no rental history', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const cosignerSection = container.querySelector('#cosigner');
      expect(cosignerSection.textContent).toMatch(/no rental history but paying a mortgage/i);
      expect(cosignerSection.textContent).toMatch(/24 months.*mortgage payment history/i);
    });
  });

  describe('Back to top links', () => {
    it('renders a back to top link in each section', () => {
      const { container } = renderWithRouter(<ApplicationRequiredDocuments />);
      const sections = container.querySelectorAll('section');
      sections.forEach((section) => {
        expect(section.querySelector('a[href="#page-top"]')).not.toBeNull();
      });
    });

    it('smooth scrolls to top when a back to top link is clicked', () => {
      const scrollIntoViewSpy = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
      renderWithRouter(<ApplicationRequiredDocuments />);
      const links = screen.getAllByRole('link', { name: /back to top/i });
      fireEvent.click(links[0]);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
      delete HTMLElement.prototype.scrollIntoView;
    });
  });

  describe('Table of contents smooth scrolling', () => {
    let scrollIntoViewSpy;

    beforeEach(() => {
      scrollIntoViewSpy = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
    });

    afterEach(() => {
      delete HTMLElement.prototype.scrollIntoView;
    });

    it('smooth scrolls to target section when a TOC link is clicked', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      const link = screen.getByRole('link', { name: /personal identification/i });
      fireEvent.click(link);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('smooth scrolls to #guarantor when that TOC link is clicked', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      const link = screen.getByRole('link', { name: /^guarantor$/i });
      fireEvent.click(link);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('smooth scrolls to #section-8 when that TOC link is clicked', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      const link = screen.getByRole('link', { name: /section 8 \/ housing assistance/i });
      fireEvent.click(link);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });
  });

  describe('Deep linking', () => {
    let scrollIntoViewSpy;

    beforeEach(() => {
      scrollIntoViewSpy = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
    });

    afterEach(() => {
      delete HTMLElement.prototype.scrollIntoView;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...window.location, hash: '' },
      });
    });

    it('scrolls to #guarantor on load', () => {
      renderWithHash('#guarantor');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #esa on load', () => {
      renderWithHash('#esa');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #section-8 on load', () => {
      renderWithHash('#section-8');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #cosigner on load', () => {
      renderWithHash('#cosigner');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #identification on load', () => {
      renderWithHash('#identification');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('does not scroll when no hash is present', () => {
      renderWithHash('');
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    });

    it('does not scroll when hash does not match any section', () => {
      renderWithHash('#nonexistent-section');
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    });
  });

  describe('Personalize wizard', () => {
    it('renders the personalize card when no profile is set', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/see only what applies to you/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /personalize this page/i })).toBeInTheDocument();
    });

    it('opens the wizard dialog when the personalize button is clicked', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      fireEvent.click(screen.getByRole('button', { name: /personalize this page/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
    });

    it('closes the wizard when the close button is clicked', async () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      fireEvent.click(screen.getByRole('button', { name: /personalize this page/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      fireEvent.click(closeButtons[0]);
      await waitFor(() => expect(screen.queryByText(/step 1 of 6/i)).not.toBeInTheDocument());
    });

    it('shows the filter banner when a profile is saved in sessionStorage', () => {
      renderWithProfile({ employment: 'employed', hasPets: 'none', benefits: ['none'], section8: 'no', guarantorCosigner: 'neither', creditScore: '650-above' });
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/filtered view/i)).toBeInTheDocument();
    });

    it('shows edit filters and reset buttons in the filter banner', () => {
      renderWithProfile({ employment: 'employed' });
      expect(screen.getByRole('button', { name: /edit filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument();
    });

    it('hides the employed section when employment is not-employed', () => {
      const { container } = renderWithProfile({ employment: 'not-employed' });
      expect(container.querySelector('#employed').getAttribute('data-filtered')).toBe('true');
    });

    it('shows the employed section when employment is employed', () => {
      const { container } = renderWithProfile({ employment: 'employed' });
      expect(container.querySelector('#employed').getAttribute('data-filtered')).toBe('false');
    });

    it('hides the self-employed section when employment is employed', () => {
      const { container } = renderWithProfile({ employment: 'employed' });
      expect(container.querySelector('#self-employed').getAttribute('data-filtered')).toBe('true');
    });

    it('shows both employed and self-employed sections when employment is both', () => {
      const { container } = renderWithProfile({ employment: 'both' });
      expect(container.querySelector('#employed').getAttribute('data-filtered')).toBe('false');
      expect(container.querySelector('#self-employed').getAttribute('data-filtered')).toBe('false');
    });

    it('hides the pets section when hasPets is none', () => {
      const { container } = renderWithProfile({ hasPets: 'none' });
      expect(container.querySelector('#pets-animals').getAttribute('data-filtered')).toBe('true');
    });

    it('shows the pets section when hasPets is pets', () => {
      const { container } = renderWithProfile({ hasPets: 'pets' });
      expect(container.querySelector('#pets-animals').getAttribute('data-filtered')).toBe('false');
    });

    it('hides the section 8 section when section8 is no', () => {
      const { container } = renderWithProfile({ section8: 'no' });
      expect(container.querySelector('#section-8').getAttribute('data-filtered')).toBe('true');
    });

    it('shows the section 8 section when section8 is yes', () => {
      const { container } = renderWithProfile({ section8: 'yes' });
      expect(container.querySelector('#section-8').getAttribute('data-filtered')).toBe('false');
    });

    it('hides the guarantor section when guarantorCosigner is neither', () => {
      const { container } = renderWithProfile({ guarantorCosigner: 'neither' });
      expect(container.querySelector('#guarantor').getAttribute('data-filtered')).toBe('true');
    });

    it('shows the guarantor section when guarantorCosigner is guarantor', () => {
      const { container } = renderWithProfile({ guarantorCosigner: 'guarantor' });
      expect(container.querySelector('#guarantor').getAttribute('data-filtered')).toBe('false');
    });

    it('hides the co-signer section when guarantorCosigner is neither', () => {
      const { container } = renderWithProfile({ guarantorCosigner: 'neither' });
      expect(container.querySelector('#cosigner').getAttribute('data-filtered')).toBe('true');
    });

    it('shows the co-signer section when guarantorCosigner is cosigner', () => {
      const { container } = renderWithProfile({ guarantorCosigner: 'cosigner' });
      expect(container.querySelector('#cosigner').getAttribute('data-filtered')).toBe('false');
    });

    it('hides benefits section when benefits is none', () => {
      const { container } = renderWithProfile({ benefits: ['none'] });
      expect(container.querySelector('#benefits').getAttribute('data-filtered')).toBe('true');
    });

    it('shows only VA benefits subsection when benefits is va', () => {
      const { container } = renderWithProfile({ benefits: ['va'] });
      expect(container.querySelector('#benefits').getAttribute('data-filtered')).toBe('false');
      expect(container.querySelector('#va-benefits').style.display).not.toBe('none');
      expect(container.querySelector('#ssdi').style.display).toBe('none');
    });

    it('hides filtered TOC links when sections are hidden', () => {
      renderWithProfile({ hasPets: 'none', section8: 'no', guarantorCosigner: 'neither', benefits: ['none'] });
      expect(screen.queryByRole('link', { name: /^pets and assistance animals$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /section 8 \/ housing assistance/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^guarantor$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^co-signer$/i })).not.toBeInTheDocument();
    });

    it('resets to show all sections when reset button is clicked', () => {
      const { container } = renderWithProfile({ hasPets: 'none' });
      expect(container.querySelector('#pets-animals').getAttribute('data-filtered')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));
      expect(container.querySelector('#pets-animals').getAttribute('data-filtered')).toBe('false');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
