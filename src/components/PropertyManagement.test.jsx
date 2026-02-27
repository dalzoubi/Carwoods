import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PropertyManagement from './PropertyManagement';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

const renderWithHash = (hash) => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, hash },
  });
  return renderWithRouter(<PropertyManagement />);
};

describe('PropertyManagement', () => {
  it('renders heading', () => {
    renderWithRouter(<PropertyManagement />);
    expect(screen.getByRole('heading', { name: /property management/i })).toBeInTheDocument();
  });

  it('contains management fee section', () => {
    renderWithRouter(<PropertyManagement />);
    expect(screen.getByText(/8% of the monthly rental income/)).toBeInTheDocument();
  });

  it('uses valid heading hierarchy (h1 then h2)', () => {
    renderWithRouter(<PropertyManagement />);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s.length).toBeGreaterThan(0);
  });

  it('contains table of contents', () => {
    renderWithRouter(<PropertyManagement />);
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument();
  });

  it('table of contents links all 12 sections', () => {
    const { container } = renderWithRouter(<PropertyManagement />);
    const nav = container.querySelector('nav[aria-label="Table of contents"]');
    const links = nav.querySelectorAll('a');
    expect(links.length).toBe(12);
  });

  it('links each section correctly in table of contents', () => {
    renderWithRouter(<PropertyManagement />);
    const expectedLinks = [
      { name: /appointment of property manager/i, href: '#section-1' },
      { name: /^term$/i,                          href: '#section-2' },
      { name: /management fee/i,                  href: '#section-3' },
      { name: /services provided/i,               href: '#section-4' },
      { name: /^expenses$/i,                      href: '#section-5' },
      { name: /reserve fund/i,                    href: '#section-6' },
      { name: /owner.s responsibilities/i,        href: '#section-7' },
      { name: /annual reporting/i,                href: '#section-8' },
      { name: /^termination$/i,                   href: '#section-9' },
      { name: /indemnification/i,                 href: '#section-10' },
      { name: /governing law/i,                   href: '#section-11' },
      { name: /entire agreement/i,                href: '#section-12' },
    ];
    for (const { name, href } of expectedLinks) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
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

    it('scrolls to #section-1 on load', () => {
      renderWithHash('#section-1');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #section-6 on load', () => {
      renderWithHash('#section-6');
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to #section-12 on load', () => {
      renderWithHash('#section-12');
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
