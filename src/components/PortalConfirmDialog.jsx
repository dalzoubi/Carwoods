import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
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
 *   confirmPhrase — string | null  (when set, confirm stays disabled until input matches exactly)
 *   confirmPhraseHint — string  (shown above the text field when confirmPhrase is set)
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
  confirmPhrase = null,
  confirmPhraseHint = '',
}) => {
  const theme = useTheme();
  const [typedPhrase, setTypedPhrase] = useState('');

  useEffect(() => {
    if (open) setTypedPhrase('');
  }, [open]);

  const phraseOk = !confirmPhrase || typedPhrase === confirmPhrase;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={TITLE_ID}
      aria-describedby={body || confirmPhrase ? DESC_ID : undefined}
    >
      <DialogTitle id={TITLE_ID} sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
        {title}
      </DialogTitle>
      {(body || confirmPhrase) && (
        <DialogContent sx={{ pt: 0 }}>
          {body ? (
            <Typography id={DESC_ID} sx={{ color: theme.palette.text.secondary, mb: confirmPhrase ? 2 : 0 }}>
              {body}
            </Typography>
          ) : null}
          {confirmPhrase ? (
            <>
              {confirmPhraseHint ? (
                <Typography id={body ? undefined : DESC_ID} variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                  {confirmPhraseHint}
                </Typography>
              ) : null}
              <TextField
                fullWidth
                size="small"
                autoComplete="off"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                disabled={loading}
                placeholder={confirmPhrase}
                inputProps={{ 'aria-label': confirmPhraseHint || confirmPhrase }}
              />
            </>
          ) : null}
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
          disabled={loading || !phraseOk}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortalConfirmDialog;
