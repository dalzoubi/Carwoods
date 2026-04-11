import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import i18n from '../i18n';
import PortalUserAvatar from './PortalUserAvatar';

const theme = createTheme();

function renderAvatar(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('PortalUserAvatar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows initials when no photo URL', () => {
    renderAvatar(
      <PortalUserAvatar firstName="Ada" lastName="Lovelace" meData={{ user: {} }} />
    );
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('uses profile_photo_url from meData', () => {
    renderAvatar(
      <PortalUserAvatar
        firstName="Ada"
        lastName="Lovelace"
        meData={{ user: { profile_photo_url: 'https://example.com/p.jpg' } }}
      />
    );
    const presentation = screen.getByRole('presentation');
    expect(presentation).toHaveAttribute('src', 'https://example.com/p.jpg');
  });

  it('photoUrl prop overrides meData', () => {
    renderAvatar(
      <PortalUserAvatar
        photoUrl="https://override.example/x.png"
        firstName="A"
        lastName="B"
        meData={{ user: { profile_photo_url: 'https://example.com/y.png' } }}
      />
    );
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'https://override.example/x.png'
    );
  });
});
