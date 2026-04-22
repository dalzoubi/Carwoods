import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HelpOutline from '@mui/icons-material/HelpOutline';
import Close from '@mui/icons-material/Close';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../../PortalAuthContext';
import SupportTicketSubmitForm from './SupportTicketSubmitForm';

/**
 * Persistent help button rendered on every authenticated portal page.
 * Opens a dialog with the ticket-submit form prefilled with diagnostics.
 * Hidden on the /portal/support route (user is already there).
 */
export default function FloatingHelpButton() {
  const { t } = useTranslation();
  const { isAuthenticated } = usePortalAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;
  if (pathname.startsWith('/portal/support') || pathname.startsWith('/portal/admin/support')) {
    return null;
  }

  const handleSubmitted = (ticket) => {
    setOpen(false);
    if (ticket?.id) {
      navigate(`/portal/support?id=${encodeURIComponent(ticket.id)}`);
    }
  };

  return (
    <>
      <Tooltip title={t('portalSupport.fab.tooltip')} arrow>
        <Fab
          color="primary"
          size={isSmall ? 'medium' : 'large'}
          onClick={() => setOpen(true)}
          aria-label={t('portalSupport.fab.ariaLabel')}
          sx={{
            position: 'fixed',
            bottom: 24,
            [isRtl ? 'left' : 'right']: 24,
            zIndex: (th) => th.zIndex.modal - 1,
          }}
          data-testid="support-fab"
        >
          <HelpOutline />
        </Fab>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={isSmall}
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}
        >
          {t('portalSupport.submit.dialogTitle')}
          <IconButton
            onClick={() => setOpen(false)}
            aria-label={t('portalSupport.submit.close')}
            size="small"
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <SupportTicketSubmitForm
            onSubmitted={handleSubmitted}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
