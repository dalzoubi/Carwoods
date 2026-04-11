import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Snackbar, Alert } from '@mui/material';

const COLOR_BY_SEVERITY = {
  success: 'success.main',
  error: 'error.main',
  warning: 'warning.main',
  info: 'text.secondary',
};

const InlineActionStatus = ({ message, reserveSpace = true }) => {
  const useSnackbar = message?.severity === 'success'
    || message?.severity === 'error'
    || message?.severity === 'warning'
    || message?.severity === 'info';
  const signature = useMemo(() => (
    message
      ? `${String(message.severity || '')}:${typeof message.text === 'string' ? message.text : ''}`
      : ''
  ), [message]);
  const lastSignatureRef = useRef('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!useSnackbar || !signature) return;
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      setOpen(true);
    }
  }, [signature, useSnackbar]);

  if (!message) {
    return reserveSpace ? <Box sx={{ flex: 1 }} /> : null;
  }
  if (useSnackbar) {
    return (
      <>
        {reserveSpace ? <Box sx={{ flex: 1 }} /> : null}
        <Snackbar
          open={open}
          autoHideDuration={5000}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity={message.severity} onClose={() => setOpen(false)} variant="filled">
            {message.text}
          </Alert>
        </Snackbar>
      </>
    );
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
