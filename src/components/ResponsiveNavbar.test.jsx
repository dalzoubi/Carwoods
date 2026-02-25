import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme';
import ResponsiveNavbar from './ResponsiveNavbar';

const renderWithProviders = (ui) => render(
  <ThemeProvider theme={theme}>
    <BrowserRouter>{ui}</BrowserRouter>
  </ThemeProvider>
);

describe('ResponsiveNavbar', () => {
  it('renders logo with alt text', () => {
    renderWithProviders(<ResponsiveNavbar />);
    expect(screen.getByAltText('Carwoods')).toBeInTheDocument();
  });

  it('renders nav links', () => {
    renderWithProviders(<ResponsiveNavbar />);
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tenant selection criteria/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /application required documents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /property management/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
  });

  it('has accessible menu button on mobile', () => {
    renderWithProviders(<ResponsiveNavbar />);
    const menuButton = screen.getByRole('button', { name: /open drawer/i });
    expect(menuButton).toBeInTheDocument();
  });
});
