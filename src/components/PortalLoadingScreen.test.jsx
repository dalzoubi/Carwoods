import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { WithAppTheme } from '../testUtils';
import i18n from '../i18n';
import PortalLoadingScreen from './PortalLoadingScreen';

describe('PortalLoadingScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders a spinner', () => {
    render(
      <WithAppTheme>
        <PortalLoadingScreen />
      </WithAppTheme>
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the Carwoods logo image', () => {
    render(
      <WithAppTheme>
        <PortalLoadingScreen />
      </WithAppTheme>
    );
    expect(screen.getByAltText('Carwoods')).toBeInTheDocument();
  });

  it('does not render any sign-in button', () => {
    render(
      <WithAppTheme>
        <PortalLoadingScreen />
      </WithAppTheme>
    );
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('does not render any feature list items', () => {
    render(
      <WithAppTheme>
        <PortalLoadingScreen />
      </WithAppTheme>
    );
    expect(screen.queryByText(/maintenance request/i)).not.toBeInTheDocument();
  });
});
