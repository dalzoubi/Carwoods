import React from 'react';
import { Box, Typography } from '@mui/material';

const COLOR_BY_SEVERITY = {
  success: 'success.main',
  error: 'error.main',
  warning: 'warning.main',
  info: 'text.secondary',
};

const InlineActionStatus = ({ message, reserveSpace = true }) => {
  if (!message) {
    return reserveSpace ? <Box sx={{ flex: 1 }} /> : null;
  }
  return (
    <Typography
      variant="body2"
      role={message.severity === 'error' ? 'alert' : 'status'}
      aria-live={message.severity === 'error' ? 'assertive' : 'polite'}
      sx={{
        flex: 1,
        minWidth: 0,
        color: COLOR_BY_SEVERITY[message.severity] || 'text.secondary',
      }}
    >
      {message.text}
    </Typography>
  );
};

export default InlineActionStatus;
