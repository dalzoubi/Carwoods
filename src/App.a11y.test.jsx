import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import App from './App';

expect.extend(toHaveNoViolations);

const renderWithProviders = (ui) => render(
  <ThemeProvider theme={theme}>{ui}</ThemeProvider>
);

describe('Accessibility (axe)', () => {
  it('Home page has no axe violations', async () => {
    const { container } = renderWithProviders(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
