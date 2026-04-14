import React from 'react';
import { Box, Stack } from '@mui/material';
import PortalUserAvatar from './PortalUserAvatar';

/**
 * Circular profile avatar to the left of arbitrary content (names in lists, MenuItems, etc.).
 */
export default function PortalPersonWithAvatar({
  photoUrl = '',
  firstName = '',
  lastName = '',
  size = 32,
  alignItems = 'center',
  avatarSx = {},
  children,
}) {
  return (
    <Stack direction="row" spacing={1} alignItems={alignItems} sx={{ minWidth: 0, width: '100%' }}>
      <PortalUserAvatar
        photoUrl={typeof photoUrl === 'string' ? photoUrl.trim() : ''}
        firstName={firstName}
        lastName={lastName}
        size={size}
        sx={{ flexShrink: 0, ...avatarSx }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
  );
}
