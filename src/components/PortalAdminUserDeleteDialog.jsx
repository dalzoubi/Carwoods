import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { deleteAdminUser } from '../lib/portalApiClient';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

/**
 * Reusable "permanently remove user" dialog. Handles reason validation,
 * the delete API call, and error mapping. Both the landlord admin page
 * and the all-users admin page render this with different display names.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {{ id: string, first_name?: string|null, last_name?: string|null, email?: string }} [props.target]
 * @param {(targetName: string) => string} [props.titleFormatter]  Override for the dialog title
 * @param {() => void} props.onClose  Called when dialog is dismissed with no delete
 * @param {(summary: object, targetName: string) => void} props.onDeleted  Called after a successful delete
 * @param {(message: string, severity?: 'error'|'success'|'info'|'warning') => void} [props.onMessage]
 *   Optional callback for user-facing feedback (e.g., a snackbar hook)
 */
const PortalAdminUserDeleteDialog = ({
  open,
  target,
  titleFormatter,
  onClose,
  onDeleted,
  onMessage,
}) => {
  const { t } = useTranslation();
  const { baseUrl, getAccessToken, handleApiForbidden } = usePortalAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open, target?.id]);

  const displayName = React.useMemo(() => {
    if (!target) return '';
    const first = String(target.first_name ?? '').trim();
    const last = String(target.last_name ?? '').trim();
    return `${first} ${last}`.trim() || String(target.email ?? '—');
  }, [target]);

  const reasonLength = reason.trim().length;
  const canSubmit =
    reasonLength >= MIN_REASON_LENGTH
    && reasonLength <= MAX_REASON_LENGTH
    && !submitting
    && Boolean(target?.id)
    && Boolean(baseUrl);

  const notify = (message, severity = 'error') => {
    if (typeof onMessage === 'function') onMessage(message, severity);
  };

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const onConfirm = async () => {
    if (!target?.id || !baseUrl) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      notify(t('portalAdminUsers.delete.reasonTooShort', { min: MIN_REASON_LENGTH }), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const accessToken = await getAccessToken();
      const payload = await deleteAdminUser(baseUrl, accessToken, target.id, { reason: trimmed });
      notify(t('portalAdminUsers.delete.success', { name: displayName }), 'success');
      onDeleted(payload?.summary ?? null, displayName);
    } catch (error) {
      handleApiForbidden(error);
      const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
      let message = t('portalAdminUsers.delete.generic');
      if (code === 'cannot_delete_self') message = t('portalAdminUsers.delete.errors.self');
      else if (code === 'cannot_delete_admin') message = t('portalAdminUsers.delete.errors.admin');
      else if (code === 'deletion_blocked') message = t('portalAdminUsers.delete.errors.blocked');
      else if (code === 'user_not_found') message = t('portalAdminUsers.delete.errors.notFound');
      else if (code === 'reason_required') {
        message = t('portalAdminUsers.delete.reasonTooShort', { min: MIN_REASON_LENGTH });
      }
      notify(message, 'error');
      setSubmitting(false);
    }
  };

  const title = titleFormatter
    ? titleFormatter(displayName)
    : t('portalAdminUsers.delete.dialogTitle', { name: displayName });

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberIcon color="error" />
          <span>{title}</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            <Typography variant="body2">
              {t('portalAdminUsers.delete.warningPrimary')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {t('portalAdminUsers.delete.warningSecondary')}
            </Typography>
          </Alert>
          <TextField
            label={t('portalAdminUsers.delete.reasonLabel')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
            disabled={submitting}
            helperText={t('portalAdminUsers.delete.reasonHelper', {
              min: MIN_REASON_LENGTH,
              max: MAX_REASON_LENGTH,
              count: reasonLength,
            })}
            inputProps={{ maxLength: MAX_REASON_LENGTH }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={close} disabled={submitting}>
          {t('portalAdminUsers.delete.cancel')}
        </Button>
        <Button
          type="button"
          variant="contained"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={() => void onConfirm()}
          disabled={!canSubmit}
        >
          {submitting
            ? t('portalAdminUsers.delete.submitting')
            : t('portalAdminUsers.delete.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortalAdminUserDeleteDialog;
