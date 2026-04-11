import React from 'react';
import { Alert, Snackbar } from '@mui/material';

const PortalFeedbackSnackbar = ({ feedback, onClose }) => (
  <Snackbar
    open={Boolean(feedback?.open)}
    autoHideDuration={feedback?.autoHideDuration ?? 5000}
    onClose={onClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
  >
    <Alert severity={feedback?.severity || 'success'} onClose={onClose} variant="filled">
      {feedback?.message || ''}
    </Alert>
  </Snackbar>
);

export default PortalFeedbackSnackbar;

