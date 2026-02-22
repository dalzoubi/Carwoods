import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from './Home';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Home', () => {
  it('renders heading', () => {
    renderWithRouter(<Home />);
    expect(screen.getByRole('heading', { name: /where houston finds home/i })).toBeInTheDocument();
  });

  it('renders introductory paragraph', () => {
    renderWithRouter(<Home />);
    expect(screen.getByText(/discover the ease of renting/i)).toBeInTheDocument();
    expect(screen.getByText(/houston and beyond/i)).toBeInTheDocument();
  });
});
