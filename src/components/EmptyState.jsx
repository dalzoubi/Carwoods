import React from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';

/**
 * Reusable empty state for lists and pages with no data.
 *
 * Props:
 *   icon            — React node (usually a large MUI icon with sx={{ fontSize: 56 }})
 *   title           — headline string
 *   description     — optional short explanatory paragraph
 *   actionLabel     — optional primary CTA label (e.g. "Add your first landlord")
 *   onAction        — callback fired when CTA is clicked
 *   actionHref      — alternative to onAction: render as a link
 *   secondaryActionLabel / onSecondaryAction — optional secondary CTA
 *   compact         — reduce vertical padding (for inline / small sections)
 *   role            — defaults to "status" so assistive tech announces empty state
 *                     when it first appears
 */
const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  role = 'status',
}) => {
  const actionProps = actionHref
    ? { component: 'a', href: actionHref }
    : { onClick: onAction };

  return (
    <Box
      role={role}
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: compact ? 3 : 6,
        px: 2,
        gap: 1.5,
        color: 'text.secondary',
      }}
    >
      {icon ? (
        <Box aria-hidden="true" sx={{ opacity: 0.5, color: 'text.disabled' }}>
          {icon}
        </Box>
      ) : null}
      {title ? (
        <Typography variant="h6" component="p" color="text.primary" fontWeight={600}>
          {title}
        </Typography>
      ) : null}
      {description ? (
        <Typography variant="body2" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}
      {(actionLabel || secondaryActionLabel) ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" justifyContent="center">
          {actionLabel ? (
            <Button variant="contained" color="primary" {...actionProps}>
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel ? (
            <Button variant="outlined" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
};

export default EmptyState;
