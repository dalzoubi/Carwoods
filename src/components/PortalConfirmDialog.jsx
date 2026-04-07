import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

const TITLE_ID = 'portal-confirm-dialog-title';
const DESC_ID = 'portal-confirm-dialog-desc';

/**
 * Generic confirmation dialog for destructive or irreversible actions.
 *
 * Props:
 *   open         — boolean
 *   onClose      — () => void  (cancel / close without acting)
 *   onConfirm    — () => void  (confirmed; caller triggers the action)
 *   title        — string
 *   body         — string  (optional detail text)
 *   confirmLabel — string  (defaults to "Confirm")
 *   cancelLabel  — string  (defaults to "Cancel")
 *   confirmColor — MUI Button color (defaults to "error")
 *   loading      — boolean  (disables buttons while in-flight)
 */
const PortalConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'error',
  loading = false,
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={TITLE_ID}
      aria-describedby={body ? DESC_ID : undefined}
    >
      <DialogTitle id={TITLE_ID} sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
        {title}
      </DialogTitle>
      {body && (
        <DialogContent sx={{ pt: 0 }}>
          <Typography id={DESC_ID} sx={{ color: theme.palette.text.secondary }}>
            {body}
          </Typography>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortalConfirmDialog;
