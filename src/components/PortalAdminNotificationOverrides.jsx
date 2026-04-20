import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import {
  fetchAdminNotificationOverrides,
  fetchAdminNotificationOverridesForUser,
  fetchAdminNotificationFlowDefaults,
} from '../lib/portalApiClient';
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';

const ROLE_FILTERS = ['', 'TENANT', 'LANDLORD', 'ADMIN'];

/** @param {unknown} err */
function serializePortalOverridesError(err) {
  if (err && typeof err === 'object') {
    const o = /** @type {{ status?: number, code?: string, message?: string, details?: unknown }} */ (err);
    return {
      status: typeof o.status === 'number' ? o.status : undefined,
      code: typeof o.code === 'string' ? o.code : '',
      message: typeof o.message === 'string' ? o.message : '',
      details: o.details,
    };
  }
  if (err instanceof Error) {
    return { status: undefined, code: '', message: `${err.name}: ${err.message}`, details: undefined };
  }
  return { status: undefined, code: '', message: String(err), details: undefined };
}

/**
 * Structured console diagnostics for User Overrides loads (browser DevTools).
 * @param {'userList' | 'flowCatalog'} stage
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra]
 */
function logPortalOverridesFailure(stage, err, extra = {}) {
  const s = serializePortalOverridesError(err);
  let hint;
  if (s.status === 404) {
    hint = 'HTTP 404: route not registered on the API host, or wrong path. After adding Functions, restart `func start` / the API.';
  } else if (s.status === 503 && s.code === 'database_unconfigured') {
    hint = 'API returned database_unconfigured (DATABASE_URL missing on Functions).';
  } else if (s.status === 503 && s.code === 'auth_unconfigured') {
    hint = 'API auth not configured for local verification.';
  } else if (s.status === 401 || s.status === 403) {
    hint = 'Token rejected or role not ADMIN — check portal sign-in and account role.';
  } else if (s.status === 0 || s.code === 'fetch_failed_cors_or_network') {
    hint = 'No HTTP response — ensure Azure Functions is running (e.g. :7071) and Vite proxies /api to it.';
  }
  console.error('[portal/admin notification overrides]', {
    stage,
    ...s,
    ...extra,
    hint: hint ?? null,
  });
}

function ChannelDot({ on, label }) {
  return (
    <Chip
      size="small"
      label={label}
      color={on ? 'primary' : 'default'}
      variant={on ? 'filled' : 'outlined'}
      sx={{ height: 20, fontSize: 11, mx: 0.25 }}
    />
  );
}

function UserDetailRow({ user, flowCatalog, fetchDetails }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const onToggle = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (details === null && user.flow_overrides_count > 0) {
      setLoading(true);
      try {
        const payload = await fetchDetails(user.user_id);
        setDetails(Array.isArray(payload?.flow_preferences) ? payload.flow_preferences : []);
      } finally {
        setLoading(false);
      }
    } else if (details === null) {
      setDetails([]);
    }
  }, [open, details, user.user_id, user.flow_overrides_count, fetchDetails]);

  const overrideByCode = useMemo(() => {
    const map = new Map();
    if (Array.isArray(details)) {
      for (const d of details) map.set(d.event_type_code, d);
    }
    return map;
  }, [details]);

  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || user.user_id;

  return (
    <>
      <TableRow hover>
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={onToggle} aria-label={open ? 'collapse' : 'expand'}>
            {open ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{fullName}</Typography>
          <Typography variant="caption" color="text.secondary">{user.email}</Typography>
        </TableCell>
        <TableCell>
          <Chip size="small" label={user.role || 'UNKNOWN'} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
        </TableCell>
        <TableCell align="center">
          <Stack direction="row" justifyContent="center" alignItems="center">
            <ChannelDot on={user.global.in_app_enabled} label={t('portalAdminNotificationOverrides.channel.inApp')} />
            <ChannelDot on={user.global.email_enabled} label={t('portalAdminNotificationOverrides.channel.email')} />
            <ChannelDot
              on={user.global.sms_enabled && user.global.sms_opt_in}
              label={t('portalAdminNotificationOverrides.channel.sms')}
            />
          </Stack>
        </TableCell>
        <TableCell align="center">
          {user.flow_overrides_count > 0 ? (
            <Chip
              size="small"
              label={t('portalAdminNotificationOverrides.overrideBadge', { count: user.flow_overrides_count })}
              color="warning"
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              {t('portalAdminNotificationOverrides.noOverrides')}
            </Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, px: 1 }}>
              {loading ? (
                <CircularProgress size={20} />
              ) : !details || details.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {t('portalAdminNotificationOverrides.detail.empty')}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('portalAdminNotificationOverrides.detail.flow')}</TableCell>
                      <TableCell align="center">{t('portalAdminNotificationOverrides.channel.inApp')}</TableCell>
                      <TableCell align="center">{t('portalAdminNotificationOverrides.channel.email')}</TableCell>
                      <TableCell align="center">{t('portalAdminNotificationOverrides.channel.sms')}</TableCell>
                      <TableCell>{t('portalAdminNotificationOverrides.detail.updatedAt')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.map((row) => {
                      const meta = flowCatalog?.find((f) => f.event_type_code === row.event_type_code);
                      const renderCell = (key, codeKey) => {
                        const v = row[codeKey];
                        if (v === null || v === undefined) {
                          return (
                            <Typography variant="caption" color="text.secondary">
                              {t('portalAdminNotificationOverrides.detail.default')}
                            </Typography>
                          );
                        }
                        return (
                          <Chip
                            size="small"
                            label={v ? t('portalAdminNotificationOverrides.on') : t('portalAdminNotificationOverrides.off')}
                            color={v ? 'primary' : 'default'}
                            variant={v ? 'filled' : 'outlined'}
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        );
                      };
                      return (
                        <TableRow key={row.event_type_code}>
                          <TableCell>
                            <Typography variant="body2">
                              {meta ? t(meta.label_key, meta.event_type_code) : row.event_type_code}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.event_type_code}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">{renderCell('in_app', 'in_app_enabled')}</TableCell>
                          <TableCell align="center">{renderCell('email', 'email_enabled')}</TableCell>
                          <TableCell align="center">{renderCell('sms', 'sms_enabled')}</TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {row.updated_at ? new Date(row.updated_at).toLocaleString() : ''}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function PortalAdminNotificationOverrides() {
  const { t } = useTranslation();
  const { baseUrl, isAuthenticated, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const [users, setUsers] = useState([]);
  const [flowCatalog, setFlowCatalog] = useState([]);
  const [filters, setFilters] = useState({ q: '', role: '', onlyCustomized: true, eventTypeCode: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [catalogWarning, setCatalogWarning] = useState('');
  const [catalogLoadFailed, setCatalogLoadFailed] = useState(false);
  const [loadFailureDebug, setLoadFailureDebug] = useState('');

  const load = useCallback(async (options = {}) => {
    const forceCatalogRetry = Boolean(options.forceCatalogRetry);
    if (!canUseModule) return;
    setStatus('loading');
    setError('');
    setLoadFailureDebug('');
    const allowCatalogFetch = forceCatalogRetry || !catalogLoadFailed;
    if (forceCatalogRetry) {
      setCatalogWarning('');
    }
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const usersPayload = await fetchAdminNotificationOverrides(baseUrl, token, {
        emailHint,
        q: filters.q,
        role: filters.role,
        onlyCustomized: filters.onlyCustomized,
        eventTypeCode: filters.eventTypeCode,
      });
      setUsers(Array.isArray(usersPayload?.users) ? usersPayload.users : []);

      if (flowCatalog.length === 0 && allowCatalogFetch) {
        try {
          const flowsPayload = await fetchAdminNotificationFlowDefaults(baseUrl, token, { emailHint });
          if (flowsPayload && Array.isArray(flowsPayload.flows)) {
            setFlowCatalog(flowsPayload.flows);
          }
          setCatalogLoadFailed(false);
          setCatalogWarning('');
        } catch (catalogErr) {
          logPortalOverridesFailure('flowCatalog', catalogErr, {
            baseUrl,
            path: '/api/portal/admin/notifications/flow-defaults',
          });
          handleApiForbidden(catalogErr);
          setCatalogLoadFailed(true);
          setCatalogWarning(t('portalAdminNotificationOverrides.errors.flowCatalogPartial'));
        }
      }

      setStatus('ok');
    } catch (loadError) {
      logPortalOverridesFailure('userList', loadError, {
        baseUrl,
        path: '/api/portal/admin/notifications/user-overrides',
        q: filters.q,
        role: filters.role,
        onlyCustomized: filters.onlyCustomized,
        eventTypeCode: filters.eventTypeCode,
      });
      handleApiForbidden(loadError);
      setStatus('error');
      setError(t('portalAdminNotificationOverrides.errors.loadFailed'));
      if (import.meta.env.DEV) {
        const s = serializePortalOverridesError(loadError);
        const parts = [
          s.status !== undefined ? `HTTP ${s.status}` : null,
          s.code ? `error=${s.code}` : null,
          s.message ? s.message : null,
        ].filter(Boolean);
        setLoadFailureDebug(parts.join(' · '));
      }
    }
  }, [
    account,
    baseUrl,
    canUseModule,
    catalogLoadFailed,
    filters.eventTypeCode,
    filters.onlyCustomized,
    filters.q,
    filters.role,
    flowCatalog.length,
    getAccessToken,
    handleApiForbidden,
    t,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchDetails = useCallback(
    async (userId) => {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      return fetchAdminNotificationOverridesForUser(baseUrl, token, userId, { emailHint });
    },
    [account, baseUrl, getAccessToken]
  );

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalAdminNotificationOverrides.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalAdminNotificationOverrides.intro')}</Typography>
          </Box>
          <PortalRefreshButton
            label={t('portalAdminNotificationOverrides.actions.refresh')}
            onClick={() => void load({ forceCatalogRetry: true })}
            disabled={!canUseModule}
            loading={status === 'loading'}
          />
        </Stack>

        <StatusAlertSlot
          message={isAuthenticated && !isAdmin
            ? { severity: 'error', text: t('portalAdminNotificationOverrides.errors.adminOnly') }
            : null}
        />
        <StatusAlertSlot message={status === 'error' ? { severity: 'error', text: error } : null} />
        {import.meta.env.DEV && loadFailureDebug ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace' }}>
            {loadFailureDebug}
          </Typography>
        ) : null}
        {catalogWarning ? (
          <Alert severity="warning" onClose={() => setCatalogWarning('')}>
            {catalogWarning}
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            label={t('portalAdminNotificationOverrides.filters.search')}
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            sx={{ minWidth: 220 }}
          />
          <TextField
            select
            size="small"
            label={t('portalAdminNotificationOverrides.filters.role')}
            value={filters.role}
            onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value }))}
            sx={{ minWidth: 140 }}
          >
            {ROLE_FILTERS.map((r) => (
              <MenuItem key={r || 'any'} value={r}>
                {r ? r : t('portalAdminNotificationOverrides.filters.anyRole')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('portalAdminNotificationOverrides.filters.eventCode')}
            value={filters.eventTypeCode}
            onChange={(e) => setFilters((p) => ({ ...p, eventTypeCode: e.target.value }))}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">{t('portalAdminNotificationOverrides.filters.anyEvent')}</MenuItem>
            {flowCatalog.map((f) => (
              <MenuItem key={f.event_type_code} value={f.event_type_code}>
                {t(f.label_key, f.event_type_code)}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={(
              <Switch
                checked={filters.onlyCustomized}
                onChange={(e) => setFilters((p) => ({ ...p, onlyCustomized: e.target.checked }))}
              />
            )}
            label={t('portalAdminNotificationOverrides.filters.onlyCustomized')}
          />
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>{t('portalAdminNotificationOverrides.columns.user')}</TableCell>
                <TableCell>{t('portalAdminNotificationOverrides.columns.role')}</TableCell>
                <TableCell align="center">{t('portalAdminNotificationOverrides.columns.global')}</TableCell>
                <TableCell align="center">{t('portalAdminNotificationOverrides.columns.flowOverrides')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status === 'loading' && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {t('portalAdminNotificationOverrides.empty')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <UserDetailRow
                    key={u.user_id}
                    user={u}
                    flowCatalog={flowCatalog}
                    fetchDetails={fetchDetails}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}
