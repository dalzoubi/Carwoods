import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { resolveRole, normalizeRole } from '../portalUtils';
import {
  fetchAdminPortalUsers,
  deleteAdminUser,
} from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalRefreshButton from './PortalRefreshButton';
import StatusAlertSlot from './StatusAlertSlot';
import EmptyState from './EmptyState';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

function displayName(u) {
  const first = String(u?.first_name ?? '').trim();
  const last = String(u?.last_name ?? '').trim();
  return `${first} ${last}`.trim() || String(u?.email ?? '—');
}

function roleChipColor(role) {
  const r = String(role ?? '').toUpperCase();
  if (r === 'ADMIN') return 'error';
  if (r === 'LANDLORD') return 'primary';
  if (r === 'TENANT') return 'info';
  return 'default';
}

const PortalAdminUsers = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
    handleApiForbidden,
  } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);
  const currentUserId = meData?.user?.id ?? null;

  const [showInactive, setShowInactive] = useState(true);
  const [usersState, setUsersState] = useState({ status: 'idle', users: [] });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    target: null,
    reason: '',
    submitting: false,
  });
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const loadUsers = useCallback(async () => {
    if (!canUseModule) {
      setUsersState({ status: 'idle', users: [] });
      return;
    }
    setUsersState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchAdminPortalUsers(baseUrl, accessToken, {
        includeInactive: showInactive,
      });
      setUsersState({
        status: 'ok',
        users: Array.isArray(payload?.users) ? payload.users : [],
      });
    } catch (error) {
      handleApiForbidden(error);
      setUsersState({ status: 'error', users: [] });
      showFeedback(t('portalAdminUsers.errors.loadFailed'), 'error');
    }
  }, [baseUrl, canUseModule, getAccessToken, handleApiForbidden, showInactive, showFeedback, t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(() => {
    const list = [...usersState.users];
    list.sort((a, b) => {
      const ra = String(a.role ?? '').toUpperCase();
      const rb = String(b.role ?? '').toUpperCase();
      if (ra !== rb) return ra.localeCompare(rb);
      return displayName(a).localeCompare(displayName(b));
    });
    return list;
  }, [usersState.users]);

  const openDelete = (target) => {
    setDeleteDialog({ open: true, target, reason: '', submitting: false });
  };

  const closeDelete = () => {
    if (deleteDialog.submitting) return;
    setDeleteDialog({ open: false, target: null, reason: '', submitting: false });
  };

  const onConfirmDelete = async () => {
    const target = deleteDialog.target;
    if (!target || !baseUrl) return;
    const reason = deleteDialog.reason.trim();
    if (reason.length < MIN_REASON_LENGTH) {
      showFeedback(
        t('portalAdminUsers.delete.reasonTooShort', { min: MIN_REASON_LENGTH }),
        'error'
      );
      return;
    }
    setDeleteDialog((prev) => ({ ...prev, submitting: true }));
    try {
      const accessToken = await getAccessToken();
      await deleteAdminUser(baseUrl, accessToken, target.id, { reason });
      showFeedback(
        t('portalAdminUsers.delete.success', { name: displayName(target) }),
        'success'
      );
      setDeleteDialog({ open: false, target: null, reason: '', submitting: false });
      void loadUsers();
    } catch (error) {
      handleApiForbidden(error);
      const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
      let message = t('portalAdminUsers.delete.generic');
      if (code === 'cannot_delete_self') message = t('portalAdminUsers.delete.errors.self');
      else if (code === 'cannot_delete_admin') message = t('portalAdminUsers.delete.errors.admin');
      else if (code === 'deletion_blocked') message = t('portalAdminUsers.delete.errors.blocked');
      else if (code === 'user_not_found') message = t('portalAdminUsers.delete.errors.notFound');
      else if (code === 'reason_required') message = t('portalAdminUsers.delete.reasonTooShort', { min: MIN_REASON_LENGTH });
      showFeedback(message, 'error');
      setDeleteDialog((prev) => ({ ...prev, submitting: false }));
    }
  };

  const reasonLength = deleteDialog.reason.trim().length;
  const canSubmitDelete =
    reasonLength >= MIN_REASON_LENGTH && reasonLength <= MAX_REASON_LENGTH && !deleteDialog.submitting;

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminUsers.title')}</title>
      </Helmet>
      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalAdminUsers.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalAdminUsers.intro')}</Typography>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalAdminUsers.errors.apiUnavailable') } : null}
        />
        {isAuthenticated && meStatus !== 'loading' && !isAdmin && (
          <StatusAlertSlot message={{ severity: 'error', text: t('portalAdminUsers.errors.adminOnly') }} />
        )}

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2.5,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalAdminUsers.list.heading')}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={(
                    <Switch
                      size="small"
                      checked={showInactive}
                      onChange={(event) => setShowInactive(event.target.checked)}
                      disabled={!canUseModule || usersState.status === 'loading'}
                    />
                  )}
                  label={t('portalAdminUsers.list.showInactive')}
                  sx={{ mr: 0 }}
                />
                <PortalRefreshButton
                  label={t('portalAdminUsers.list.refresh')}
                  onClick={() => void loadUsers()}
                  disabled={!canUseModule}
                  loading={usersState.status === 'loading'}
                />
              </Stack>
            </Stack>

            {usersState.status !== 'loading' && sortedUsers.length === 0 && (
              <EmptyState
                icon={<SupervisorAccountIcon sx={{ fontSize: 56 }} />}
                title={t('portalAdminUsers.list.emptyTitle')}
                description={t('portalAdminUsers.list.emptyDescription')}
              />
            )}

            {sortedUsers.map((u) => {
              const isSelf = currentUserId && u.id === currentUserId;
              const isProtectedAdmin = String(u.role ?? '').toUpperCase() === 'ADMIN';
              return (
                <Box
                  key={u.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    p: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 600 }}>{displayName(u)}</Typography>
                        <Chip
                          label={String(u.role ?? '').toUpperCase()}
                          size="small"
                          color={roleChipColor(u.role)}
                          variant="outlined"
                        />
                        <Chip
                          label={String(u.status ?? '').toUpperCase()}
                          size="small"
                          color={
                            String(u.status ?? '').toUpperCase() === 'ACTIVE' ? 'success' : 'default'
                          }
                          variant={
                            String(u.status ?? '').toUpperCase() === 'ACTIVE' ? 'filled' : 'outlined'
                          }
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {u.email}
                      </Typography>
                    </Box>
                    <Tooltip
                      title={
                        isSelf
                          ? t('portalAdminUsers.delete.disabledSelf')
                          : isProtectedAdmin
                            ? t('portalAdminUsers.delete.disabledAdmin')
                            : t('portalAdminUsers.delete.cta')
                      }
                    >
                      <span>
                        <IconButton
                          type="button"
                          color="error"
                          onClick={() => openDelete(u)}
                          disabled={!canUseModule || isSelf || isProtectedAdmin}
                          aria-label={t('portalAdminUsers.delete.cta')}
                        >
                          <DeleteForeverIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Stack>

      <Dialog
        open={deleteDialog.open}
        onClose={closeDelete}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningAmberIcon color="error" />
            <span>
              {t('portalAdminUsers.delete.dialogTitle', {
                name: deleteDialog.target ? displayName(deleteDialog.target) : '',
              })}
            </span>
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
              value={deleteDialog.reason}
              onChange={(e) => setDeleteDialog((prev) => ({ ...prev, reason: e.target.value }))}
              multiline
              minRows={3}
              required
              fullWidth
              disabled={deleteDialog.submitting}
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
          <Button
            type="button"
            onClick={closeDelete}
            disabled={deleteDialog.submitting}
          >
            {t('portalAdminUsers.delete.cancel')}
          </Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => void onConfirmDelete()}
            disabled={!canSubmitDelete}
          >
            {deleteDialog.submitting
              ? t('portalAdminUsers.delete.submitting')
              : t('portalAdminUsers.delete.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminUsers;
