import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Apply from './Apply';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Apply', () => {
  it('renders heading', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('heading', { name: /how to apply to rent/i })).toBeInTheDocument();
  });

  it('renders steps and links to Selection Criteria and Required Documents', () => {
    renderWithRouter(<Apply />);
    const criteriaLinks = screen.getAllByRole('link', { name: /tenant selection criteria/i });
    const docsLinks = screen.getAllByRole('link', { name: /required documents/i });
    expect(criteriaLinks[0]).toHaveAttribute('href', '/tenant-selection-criteria');
    expect(docsLinks[0]).toHaveAttribute('href', '/application-required-documents');
  });

  it('links to har.com for submission', () => {
    renderWithRouter(<Apply />);
    const harLinks = screen.getAllByRole('link', { name: /har\.com/i });
    const harLink = harLinks.find((el) => el.getAttribute('href') === 'https://www.har.com') ?? harLinks[0];
    expect(harLink).toHaveAttribute('href', 'https://www.har.com');
    expect(harLink).toHaveAttribute('target', '_blank');
    expect(harLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders rental property tiles linking to RentSpree apply URLs', () => {
    renderWithRouter(<Apply />);
    const bonnie = screen.getByRole('link', { name: /apply for 6314 bonnie chase ln/i });
    expect(bonnie).toHaveAttribute('href', 'https://apply.link/Ba5-sy4');
    expect(bonnie).toHaveAttribute('target', '_blank');
    const sunrise = screen.getByRole('link', { name: /apply for 18920 sunrise ranch ct/i });
    expect(sunrise).toHaveAttribute('href', 'https://apply.link/IUh3SsI');
  });

  it('links to Contact Us', () => {
    renderWithRouter(<Apply />);
    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', '/contact-us');
  });
});
