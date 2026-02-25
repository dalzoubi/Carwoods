import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TenantSelectionCriteria from './TenantSelectionCriteria';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('TenantSelectionCriteria', () => {
  it('renders heading', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getByRole('heading', { name: /tenant selection criteria/i })).toBeInTheDocument();
  });

  it('contains fair housing statement', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getByText(/we do not discriminate based on race, color, religion, sex, familial status, national origin, disability/i)).toBeInTheDocument();
  });

  it('contains table of contents', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument();
  });

  it('contains employment section', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getByRole('heading', { name: /employment/i })).toBeInTheDocument();
  });

  it('contains credit score requirement', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getByText(/650/)).toBeInTheDocument();
  });

  describe('Guarantor policy section', () => {
    it('renders the guarantor policy section', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByRole('heading', { name: /guarantor policy/i })).toBeInTheDocument();
    });

    it('states guarantor is only liable after primary tenant defaults', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/financially responsible for the lease obligations if the tenant fails to pay/i)).toBeInTheDocument();
    });

    it('requires guarantor credit score of 700', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/700/)).toBeInTheDocument();
    });

    it('requires guarantor income of 4x monthly rent', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/4× the monthly rent/i)).toBeInTheDocument();
    });

    it('links guarantor policy in table of contents', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByRole('link', { name: /guarantor policy/i })).toHaveAttribute('href', '#guarantor-policy');
    });
  });

  describe('Co-signer policy section', () => {
    it('renders the co-signer policy section', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByRole('heading', { name: /co-signer policy/i })).toBeInTheDocument();
    });

    it('distinguishes co-signer from guarantor', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/a co-signer is not the same as a guarantor/i)).toBeInTheDocument();
    });

    it('states co-signer is liable from day one', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/liable from day one/i)).toBeInTheDocument();
    });

    it('states co-signer signs the lease itself', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/co-signer signs the lease itself/i)).toBeInTheDocument();
    });

    it('requires co-signer to meet all the same qualification standards as primary applicant', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByText(/must meet all the same income, credit, background, employment, and rental history requirements/i)).toBeInTheDocument();
    });

    it('requires co-signer income of 4x monthly rent', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      const matches = screen.getAllByText(/4× the monthly rent/i);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('links co-signer policy in table of contents', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getByRole('link', { name: /co-signer policy/i })).toHaveAttribute('href', '#cosigner-policy');
    });
  });
});
