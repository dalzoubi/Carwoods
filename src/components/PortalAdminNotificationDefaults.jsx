import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import {
  fetchAdminNotificationFlowDefaults,
  patchAdminNotificationFlowDefault,
  deleteAdminNotificationFlowDefault,
} from '../lib/portalApiClient';
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';
import PortalConfigOptionHelp from './PortalConfigOptionHelp';

/**
 * Admin tab: edit the system-wide per-flow notification channel defaults.
 *
 * Each row shows the flow's friendly label + info icon, the three channel
 * switches (in-app/email/SMS), and a source chip (CODE = compile-time,
 * ADMIN = stored override). Toggling a switch immediately PATCHes the
 * override so admins don't have to remember to save.
 */
const CATEGORY_ORDER = ['ONBOARDING', 'MAINTENANCE', 'SECURITY_COMPLIANCE'];

export default function PortalAdminNotificationDefaults() {
  const { t } = useTranslation();
  const { baseUrl, isAuthenticated, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const [flows, setFlows] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [pendingCode, setPendingCode] = useState('');

  const load = useCallback(async () => {
    if (!canUseModule) {
      setStatus('idle');
      setFlows([]);
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchAdminNotificationFlowDefaults(baseUrl, token, { emailHint });
      setFlows(Array.isArray(payload?.flows) ? payload.flows : []);
      setStatus('ok');
    } catch (loadError) {
      handleApiForbidden(loadError);
      setStatus('error');
      setError(t('portalAdminNotificationDefaults.errors.loadFailed'));
    }
  }, [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const out = { ONBOARDING: [], MAINTENANCE: [], SECURITY_COMPLIANCE: [] };
    for (const f of flows) {
      (out[f.category] ?? out.MAINTENANCE).push(f);
    }
    return out;
  }, [flows]);

  const persist = useCallback(
    async (flow, channel, value) => {
      if (!canUseModule || !flow.user_overridable && channel !== 'reset') return;
      setPendingCode(flow.event_type_code);
      setError('');
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        if (channel === 'reset') {
          await deleteAdminNotificationFlowDefault(baseUrl, token, flow.event_type_code, { emailHint });
        } else {
          const next = {
            email_enabled: channel === 'email' ? value : flow.email_enabled,
            in_app_enabled: channel === 'in_app' ? value : flow.in_app_enabled,
            sms_enabled: channel === 'sms' ? value : flow.sms_enabled,
            quiet_hours_bypass: flow.quiet_hours_bypass,
          };
          await patchAdminNotificationFlowDefault(baseUrl, token, flow.event_type_code, {
            emailHint,
            ...next,
          });
        }
        await load();
      } catch (saveError) {
        handleApiForbidden(saveError);
        setError(t('portalAdminNotificationDefaults.errors.saveFailed'));
      } finally {
        setPendingCode('');
      }
    },
    [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden, load, t]
  );

  const renderRow = (flow) => {
    const isPending = pendingCode === flow.event_type_code;
    return (
      <TableRow key={flow.event_type_code} hover>
        <TableCell>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {t(flow.label_key, flow.event_type_code)}
            </Typography>
            <PortalConfigOptionHelp labelKey={flow.label_key} bodyKey={flow.info_key} />
          </Stack>
          <Typography variant="caption" color="text.secondary">{flow.event_type_code}</Typography>
        </TableCell>
        <TableCell align="center">
          <Switch
            size="small"
            checked={Boolean(flow.in_app_enabled)}
            onChange={(e) => persist(flow, 'in_app', e.target.checked)}
            disabled={!canUseModule || isPending}
            inputProps={{ 'aria-label': t('portalAdminNotificationDefaults.channel.inApp') }}
          />
        </TableCell>
        <TableCell align="center">
          <Switch
            size="small"
            checked={Boolean(flow.email_enabled)}
            onChange={(e) => persist(flow, 'email', e.target.checked)}
            disabled={!canUseModule || isPending}
            inputProps={{ 'aria-label': t('portalAdminNotificationDefaults.channel.email') }}
          />
        </TableCell>
        <TableCell align="center">
          <Switch
            size="small"
            checked={Boolean(flow.sms_enabled)}
            onChange={(e) => persist(flow, 'sms', e.target.checked)}
            disabled={!canUseModule || isPending}
            inputProps={{ 'aria-label': t('portalAdminNotificationDefaults.channel.sms') }}
          />
        </TableCell>
        <TableCell align="center">
          <Tooltip
            title={
              flow.source === 'ADMIN'
                ? t('portalAdminNotificationDefaults.source.adminTooltip')
                : t('portalAdminNotificationDefaults.source.codeTooltip')
            }
          >
            <Chip
              size="small"
              label={
                flow.source === 'ADMIN'
                  ? t('portalAdminNotificationDefaults.source.admin')
                  : t('portalAdminNotificationDefaults.source.code')
              }
              color={flow.source === 'ADMIN' ? 'primary' : 'default'}
              variant={flow.source === 'ADMIN' ? 'filled' : 'outlined'}
              sx={{ height: 22, fontSize: 11 }}
            />
          </Tooltip>
        </TableCell>
        <TableCell align="right">
          <Button
            size="small"
            variant="text"
            disabled={!canUseModule || isPending || flow.source !== 'ADMIN'}
            onClick={() => persist(flow, 'reset')}
          >
            {t('portalAdminNotificationDefaults.actions.resetToCode')}
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalAdminNotificationDefaults.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalAdminNotificationDefaults.intro')}</Typography>
          </Box>
          <PortalRefreshButton
            label={t('portalAdminNotificationDefaults.actions.refresh')}
            onClick={() => void load()}
            disabled={!canUseModule}
            loading={status === 'loading'}
          />
        </Stack>

        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalAdminNotificationDefaults.errors.signInRequired') } : null}
        />
        <StatusAlertSlot
          message={isAuthenticated && !isAdmin
            ? { severity: 'error', text: t('portalAdminNotificationDefaults.errors.adminOnly') }
            : null}
        />
        <StatusAlertSlot
          message={status === 'error' ? { severity: 'error', text: error } : null}
        />

        {status === 'loading' && flows.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const rows = grouped[cat] ?? [];
            if (!rows.length) return null;
            return (
              <Box key={cat}>
                <Typography variant="overline" color="text.secondary">
                  {t(`portalAdminNotificationDefaults.groups.${cat.toLowerCase()}`)}
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 0.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('portalAdminNotificationDefaults.columns.flow')}</TableCell>
                        <TableCell align="center">{t('portalAdminNotificationDefaults.channel.inApp')}</TableCell>
                        <TableCell align="center">{t('portalAdminNotificationDefaults.channel.email')}</TableCell>
                        <TableCell align="center">{t('portalAdminNotificationDefaults.channel.sms')}</TableCell>
                        <TableCell align="center">{t('portalAdminNotificationDefaults.columns.source')}</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>{rows.map(renderRow)}</TableBody>
                  </Table>
                </TableContainer>
              </Box>
            );
          })
        )}
      </Stack>
    </Paper>
  );
}
