import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';

const PortalRefreshButton = ({
  label,
  onClick,
  disabled = false,
  loading = false,
}) => (
  <Button
    type="button"
    size="small"
    variant="outlined"
    aria-label={label}
    onClick={onClick}
    disabled={disabled || loading}
    sx={{
      minWidth: 'auto',
      width: 32,
      height: 32,
      p: 0,
      flexShrink: 0,
    }}
  >
    {loading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
  </Button>
);

export default PortalRefreshButton;
