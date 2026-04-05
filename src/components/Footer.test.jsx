import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Footer from './Footer';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Footer', () => {
  it('renders copyright', () => {
    renderWithRouter(<Footer />);
    expect(screen.getByText(/© 2026 Carwoods/i)).toBeInTheDocument();
  });

  it('renders TREC Consumer Protection link', () => {
    renderWithRouter(<Footer />);
    const link = screen.getByRole('link', { name: /texas real estate commission consumer protection notice/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('trec.texas.gov'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders TREC IABS link', () => {
    renderWithRouter(<Footer />);
    const link = screen.getByRole('link', { name: /texas real estate commission information about brokerage services/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('har.com'));
    expect(link).toHaveAttribute('target', '_blank');
  });

});
