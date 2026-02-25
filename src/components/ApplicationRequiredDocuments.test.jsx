import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ApplicationRequiredDocuments from './ApplicationRequiredDocuments';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('ApplicationRequiredDocuments', () => {
  it('renders heading', () => {
    renderWithRouter(<ApplicationRequiredDocuments />);
    expect(screen.getByRole('heading', { name: /application required documents/i })).toBeInTheDocument();
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
      expect(screen.getByText(/pets and assistance animals/i)).toBeInTheDocument();
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
      expect(screen.getByText(/child support or spousal maintenance/i)).toBeInTheDocument();
      expect(screen.getByText(/court order or divorce decree/i)).toBeInTheDocument();
      expect(screen.getByText(/oag.*texas office of the attorney general/i)).toBeInTheDocument();
    });

    it('covers all other benefits with a catch-all requirement', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/all other benefits/i)).toBeInTheDocument();
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
  });

  describe('Co-signer section', () => {
    it('renders the co-signer section heading', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/if a co-signer is required/i)).toBeInTheDocument();
    });

    it('distinguishes co-signer from guarantor', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/a co-signer is not the same as a guarantor/i)).toBeInTheDocument();
    });

    it('states co-signer is jointly and severally liable from day one', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/jointly and severally liable for all lease obligations from day one/i)).toBeInTheDocument();
    });

    it('requires co-signer to provide 24 months of landlord references', () => {
      renderWithRouter(<ApplicationRequiredDocuments />);
      expect(screen.getByText(/landlord reference information for the past.*24 months/i)).toBeInTheDocument();
    });
  });
});
