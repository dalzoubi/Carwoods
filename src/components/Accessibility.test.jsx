import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Accessibility from './Accessibility';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Accessibility', () => {
  it('renders heading', () => {
    renderWithRouter(<Accessibility />);
    expect(screen.getByRole('heading', { name: /accessibility statement/i })).toBeInTheDocument();
  });

  it('contains WCAG commitment', () => {
    renderWithRouter(<Accessibility />);
    expect(screen.getByText(/wcag 2\.1 at level aa/i)).toBeInTheDocument();
    expect(screen.getByText(/accessible to people with disabilities/i)).toBeInTheDocument();
  });

  it('renders Measures We Take section', () => {
    renderWithRouter(<Accessibility />);
    expect(screen.getByRole('heading', { name: /measures we take/i })).toBeInTheDocument();
    expect(screen.getByText(/semantic html and clear heading structure/i)).toBeInTheDocument();
    expect(screen.getByText(/keyboard navigable content/i)).toBeInTheDocument();
    expect(screen.getByText(/alternative text for images/i)).toBeInTheDocument();
    expect(screen.getByText(/skip links for keyboard users/i)).toBeInTheDocument();
  });

  it('renders Feedback section with link to contact page', () => {
    renderWithRouter(<Accessibility />);
    expect(screen.getByRole('heading', { name: /^feedback$/i })).toBeInTheDocument();
    const contactLink = screen.getByRole('link', { name: /contact us/i });
    expect(contactLink).toHaveAttribute('href', '/contact-us');
    expect(screen.getByText(/accessibility barriers/i)).toBeInTheDocument();
  });

  it('displays last updated date', () => {
    renderWithRouter(<Accessibility />);
    expect(screen.getByText(/last updated: february 2025/i)).toBeInTheDocument();
  });
});
