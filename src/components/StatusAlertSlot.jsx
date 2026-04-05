import React from 'react';
import { Alert, Box } from '@mui/material';

const StatusAlertSlot = ({ message, minHeight = 56 }) => (
  <Box sx={{ minHeight }}>
    {message && <Alert severity={message.severity}>{message.text}</Alert>}
  </Box>
);

export default StatusAlertSlot;
