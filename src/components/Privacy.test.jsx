import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Privacy from './Privacy';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Privacy', () => {
  it('renders heading', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
  });

  it('contains introductory commitment to privacy', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByText(/carwoods.*committed to protecting your privacy/i)).toBeInTheDocument();
  });

  it('renders Information We Collect section', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByRole('heading', { name: /information we collect/i })).toBeInTheDocument();
    expect(screen.getByText(/har\.com for property inquiries/i)).toBeInTheDocument();
  });

  it('renders How We Use Information section', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByRole('heading', { name: /how we use information/i })).toBeInTheDocument();
    expect(screen.getByText(/we do not sell your personal information/i)).toBeInTheDocument();
  });

  it('renders Third Parties section', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByRole('heading', { name: /third parties/i })).toBeInTheDocument();
    expect(screen.getByText(/texas real estate commission/i)).toBeInTheDocument();
  });

  it('renders Contact section with link to contact page', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByRole('heading', { name: /^contact$/i })).toBeInTheDocument();
    const contactLink = screen.getByRole('link', { name: /contact us/i });
    expect(contactLink).toHaveAttribute('href', '/contact-us');
  });

  it('displays last updated date', () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByText(/last updated: february 2025/i)).toBeInTheDocument();
  });
});
