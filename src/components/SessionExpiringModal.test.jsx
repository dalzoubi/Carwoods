import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../i18n';
import SessionExpiringModal from './SessionExpiringModal';

describe('SessionExpiringModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the countdown, Stay, and Sign-out buttons when open', () => {
    render(
      <SessionExpiringModal
        open={true}
        deadlineAt={Date.now() + 45_000}
        onStay={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(screen.getByText(/still there/i)).toBeInTheDocument();
    // Body mentions "45 seconds" (or 44 if the second ticked — allow either).
    const body = screen.getByText(/signed out in \d+ seconds/i);
    expect(body).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stay signed in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out now/i })).toBeInTheDocument();
  });

  it('invokes onStay and onSignOut when the corresponding buttons are clicked', async () => {
    const user = userEvent.setup();
    const onStay = vi.fn();
    const onSignOut = vi.fn();

    render(
      <SessionExpiringModal
        open={true}
        deadlineAt={Date.now() + 60_000}
        onStay={onStay}
        onSignOut={onSignOut}
      />
    );

    await user.click(screen.getByRole('button', { name: /stay signed in/i }));
    expect(onStay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /sign out now/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders nothing visible when closed', () => {
    render(
      <SessionExpiringModal
        open={false}
        deadlineAt={Date.now() + 60_000}
        onStay={() => {}}
        onSignOut={() => {}}
      />
    );
    expect(screen.queryByText(/still there/i)).not.toBeInTheDocument();
  });
});
