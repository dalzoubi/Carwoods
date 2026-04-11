import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Snackbar } from '@mui/material';

const StatusAlertSlot = ({ message }) => {
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
  if (!message) return null;
  if (useSnackbar) {
    return (
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
    );
  }
  return (
    <Box>
      <Alert severity={message.severity}>{message.text}</Alert>
    </Box>
  );
};

export default StatusAlertSlot;
