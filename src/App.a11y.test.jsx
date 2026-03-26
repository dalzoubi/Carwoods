import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import App from './App';
import { WithAppTheme } from './testUtils';

expect.extend(toHaveNoViolations);

const renderWithProviders = (ui) => render(
  <WithAppTheme>{ui}</WithAppTheme>
);

describe('Accessibility (axe)', () => {
  it('Home page has no axe violations', async () => {
    const { container } = renderWithProviders(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
