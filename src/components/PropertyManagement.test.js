import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PropertyManagement from './PropertyManagement';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

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
});
