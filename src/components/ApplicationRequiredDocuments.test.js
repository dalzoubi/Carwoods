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
      expect(screen.getByText(/completed rental application and consent to full credit, background, and rental history screening/i)).toBeInTheDocument();
    });
  });
});
