import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

const TITLE_ID = 'portal-signout-confirm-title';
const DESC_ID = 'portal-signout-confirm-desc';

const PortalSignOutConfirmDialog = ({ open, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={TITLE_ID}
      aria-describedby={DESC_ID}
    >
      <DialogTitle id={TITLE_ID} sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
        {t('portalHeader.confirmSignOut.title')}
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography id={DESC_ID} sx={{ color: theme.palette.text.secondary }}>
          {t('portalHeader.confirmSignOut.body')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button type="button" variant="outlined" color="inherit" onClick={onClose}>
          {t('portalHeader.confirmSignOut.cancel')}
        </Button>
        <Button type="button" variant="contained" color="error" onClick={onConfirm}>
          {t('portalHeader.confirmSignOut.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortalSignOutConfirmDialog;
