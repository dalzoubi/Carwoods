import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import App from './App';

const renderWithProviders = (ui) => render(
  <ThemeProvider theme={theme}>{ui}</ThemeProvider>
);

describe('App', () => {
  it('renders navbar and footer', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByLabelText('footer')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders Home content at root path', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('heading', { name: /where houston finds home/i })).toBeInTheDocument();
  });
});
