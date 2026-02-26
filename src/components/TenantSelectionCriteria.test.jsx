import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TenantSelectionCriteria from './TenantSelectionCriteria';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

const renderWithHash = (hash) => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash },
  });
  return renderWithRouter(<TenantSelectionCriteria />);
};

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

  it('uses alphabetic (a, b, c) numbering for Details sub-list in table of contents', () => {
    const { container } = renderWithRouter(<TenantSelectionCriteria />);
    const nav = container.querySelector('nav[aria-label="Table of contents"]');
    const alphaLists = nav.querySelectorAll('ol[type="a"]');
    expect(alphaLists.length).toBeGreaterThanOrEqual(1);
  });

  it('contains employment section', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getByRole('heading', { name: /employment/i })).toBeInTheDocument();
  });

  it('contains credit score requirement', () => {
    renderWithRouter(<TenantSelectionCriteria />);
    expect(screen.getAllByText(/650/).length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getAllByText(/700/).length).toBeGreaterThanOrEqual(1);
    });

    it('requires guarantor income of 4x monthly rent', () => {
      renderWithRouter(<TenantSelectionCriteria />);
      expect(screen.getAllByText(/4× the monthly rent/i).length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getByText(/not the same as a guarantor/i)).toBeInTheDocument();
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

    it('scrolls to #credit-exception on load', () => {
      renderWithHash('#credit-exception');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #guarantor-policy on load', () => {
      renderWithHash('#guarantor-policy');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #cosigner-policy on load', () => {
      renderWithHash('#cosigner-policy');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #employment on load', () => {
      renderWithHash('#employment');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #pets on load', () => {
      renderWithHash('#pets');
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
});
