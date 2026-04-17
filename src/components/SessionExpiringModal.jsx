import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Warning modal shown shortly before an idle-timeout auto sign-out.
 * Renders a 1-second countdown so the user sees how long they have left.
 */
const SessionExpiringModal = ({ open, deadlineAt, onStay, onSignOut }) => {
  const { t } = useTranslation();
  const [remainingMs, setRemainingMs] = useState(() =>
    typeof deadlineAt === 'number' ? Math.max(0, deadlineAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!open || typeof deadlineAt !== 'number') return undefined;
    setRemainingMs(Math.max(0, deadlineAt - Date.now()));
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, deadlineAt - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [open, deadlineAt]);

  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <Dialog
      open={open}
      onClose={onStay}
      aria-labelledby="session-expiring-title"
      aria-live="polite"
    >
      <DialogTitle id="session-expiring-title">
        {t('session.expiring.title')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('session.expiring.body', { seconds })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onSignOut} color="inherit">
          {t('session.expiring.signOut')}
        </Button>
        <Button onClick={onStay} variant="contained">
          {t('session.expiring.stay')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionExpiringModal;
