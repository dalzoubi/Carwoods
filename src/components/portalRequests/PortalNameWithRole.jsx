import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { Role } from '../../domain/constants.js';
import { normalizeRole } from '../../portalUtils';
import MailtoEmailLink, { isDisplayableEmail } from '../MailtoEmailLink';

export function roleLabel(roleValue, t) {
  const role = normalizeRole(roleValue);
  if (role === Role.ADMIN) return t('portalHeader.roles.admin');
  if (role === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (role === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
}

const chipSxMessageThread = { height: 20, fontSize: '0.7rem' };

/**
 * Displays a person’s display name and role chip using the same layout and chip
 * styling as the request message thread (name + pill on one row).
 */
export default function PortalNameWithRole({
  name,
  role,
  t,
  roleLabelOverride = '',
  chipColor = 'primary',
  chipVariant = 'outlined',
  avatar = null,
  roleChipTooltip = '',
  /** When true, keep name and pill on one line and ellipsis-overflow long names (e.g. narrow attachment tiles). */
  truncateName = false,
  stackSx = {},
}) {
  const chipLabel = roleLabelOverride || roleLabel(role, t);
  const chip = (
    <Chip
      label={chipLabel}
      size="small"
      color={chipColor}
      variant={chipVariant}
      sx={{
        ...chipSxMessageThread,
        flexShrink: 0,
        ...(truncateName
          ? {
              maxWidth: 'min(100%, 7rem)',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }
          : {}),
      }}
    />
  );
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{
        flexWrap: truncateName ? 'nowrap' : 'wrap',
        minWidth: 0,
        ...stackSx,
      }}
    >
      {avatar ? <Box sx={{ flexShrink: 0 }}>{avatar}</Box> : null}
      <Typography
        component="div"
        sx={{
          fontWeight: 600,
          minWidth: 0,
          ...(truncateName
            ? {
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }
            : {}),
        }}
      >
        {typeof name === 'string' && isDisplayableEmail(name) ? (
          <MailtoEmailLink
            email={name}
            color="inherit"
            sx={{
              fontWeight: 600,
              ...(truncateName
                ? {
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }
                : {}),
            }}
          />
        ) : (
          name
        )}
      </Typography>
      {roleChipTooltip ? (
        <Tooltip title={roleChipTooltip}>
          <Box component="span" sx={{ display: 'inline-flex', maxWidth: '100%', flexShrink: 0 }}>
            {chip}
          </Box>
        </Tooltip>
      ) : (
        chip
      )}
    </Stack>
  );
}
