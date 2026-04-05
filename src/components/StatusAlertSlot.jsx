import React from 'react';
import { Alert, Box } from '@mui/material';

const StatusAlertSlot = ({ message }) => {
  if (!message) return null;
  return (
    <Box>
      <Alert severity={message.severity}>{message.text}</Alert>
    </Box>
  );
};

export default StatusAlertSlot;
