import React from 'react';
import { Alert, Snackbar } from '@mui/material';

/**
 * Default auto-hide. Errors get a longer window (errors are harder to read
 * and users often need to copy details before the toast disappears).
 */
const DEFAULT_HIDE_MS = 5000;
const ERROR_HIDE_MS = 9000;

const PortalFeedbackSnackbar = ({ feedback, onClose }) => {
  const severity = feedback?.severity || 'success';
  const isError = severity === 'error';
  const duration = feedback?.autoHideDuration
    ?? (isError ? ERROR_HIDE_MS : DEFAULT_HIDE_MS);

  return (
    <Snackbar
      open={Boolean(feedback?.open)}
      autoHideDuration={duration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity={severity}
        onClose={onClose}
        variant="filled"
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
      >
        {feedback?.message || ''}
      </Alert>
    </Snackbar>
  );
};

export default PortalFeedbackSnackbar;
