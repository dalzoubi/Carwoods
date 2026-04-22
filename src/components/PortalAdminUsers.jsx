import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { resolveRole, normalizeRole } from '../portalUtils';
import { fetchAdminPortalUsers } from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalRefreshButton from './PortalRefreshButton';
import PortalAdminUserDeleteDialog from './PortalAdminUserDeleteDialog';
import StatusAlertSlot from './StatusAlertSlot';
import EmptyState from './EmptyState';

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
  const [deleteTarget, setDeleteTarget] = useState(null);
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
                          onClick={() => setDeleteTarget(u)}
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

      <PortalAdminUserDeleteDialog
        open={Boolean(deleteTarget)}
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          void loadUsers();
        }}
        onMessage={(message, severity) => showFeedback(message, severity)}
      />

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminUsers;
