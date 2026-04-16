import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ContactUs from './ContactUs';

const renderWithRouter = (ui) => render(<HelmetProvider><BrowserRouter>{ui}</BrowserRouter></HelmetProvider>);

describe('ContactUs', () => {
  it('renders heading', () => {
    renderWithRouter(<ContactUs />);
    expect(screen.getByRole('heading', { name: /contact us/i })).toBeInTheDocument();
  });

  it('renders HAR agent link', () => {
    renderWithRouter(<ContactUs />);
    const link = screen.getByRole('link', { name: /contact our agent on har\.com/i });
    expect(link).toHaveAttribute('href', 'https://www.har.com/dennis-alzoubi/agent_dalzoubi');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('explains redirect to HAR', () => {
    renderWithRouter(<ContactUs />);
    expect(screen.getAllByText(/har\.com/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/houston association of realtors/i)).toBeInTheDocument();
  });

  it('links to Apply as the primary path', () => {
    renderWithRouter(<ContactUs />);
    const applyLink = screen.getByRole('link', { name: /^apply$/i });
    expect(applyLink).toHaveAttribute('href', '/apply');
  });

  it('keeps dark preview prefix on Apply link', () => {
    render(
      <HelmetProvider>
      <MemoryRouter initialEntries={['/dark/contact-us']}>
        <ContactUs />
      </MemoryRouter>
      </HelmetProvider>
    );
    const applyLink = screen.getByRole('link', { name: /^apply$/i });
    expect(applyLink).toHaveAttribute('href', '/dark/apply');
  });
});
