import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import {
  fetchAdminNotificationReport,
  fetchAdminNotificationFlowDefaults,
  fetchAdminNotificationOverrides,
} from '../lib/portalApiClient';
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';

const PRESET_RANGES = [
  { key: '24h', hours: 24 },
  { key: '7d', hours: 24 * 7 },
  { key: '30d', hours: 24 * 30 },
  { key: '90d', hours: 24 * 90 },
];

const GROUP_BY = ['day', 'hour', 'channel', 'event', 'role', 'status'];
const CHANNELS = ['', 'EMAIL', 'SMS', 'IN_APP'];

function channelFilterLabel(t, code) {
  if (!code) return t('portalAdminNotificationReport.filters.anyChannel');
  if (code === 'EMAIL') return t('portalAdminNotificationReport.filters.channelEmail');
  if (code === 'SMS') return t('portalAdminNotificationReport.filters.channelSms');
  if (code === 'IN_APP') return t('portalAdminNotificationReport.filters.channelInApp');
  return code;
}
const STATUSES = ['', 'QUEUED', 'SENT', 'FAILED'];

function isoLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function StatCard({ label, value, accent, subtitle }) {
  const display =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString()
      : value;
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: accent || 'text.primary' }}>{display}</Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Paper>
  );
}

function MiniBarSeries({ rows }) {
  if (!rows?.length) return null;
  const max = rows.reduce((m, r) => Math.max(m, Number(r.total) || 0), 0) || 1;
  return (
    <Stack spacing={0.5} sx={{ width: '100%' }}>
      {rows.map((r, idx) => (
        <Stack key={`${String(r.bucket)}-${idx}`} direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" sx={{ width: 130, flexShrink: 0, fontFamily: 'monospace' }}>
            {String(r.bucket).slice(0, 19)}
          </Typography>
          <Box sx={{ flex: 1, position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${(Number(r.sent) / max) * 100}%`, bgcolor: 'success.light',
            }} />
            <Box sx={{
              position: 'absolute', left: `${(Number(r.sent) / max) * 100}%`, top: 0, bottom: 0,
              width: `${(Number(r.failed) / max) * 100}%`, bgcolor: 'error.light',
            }} />
            <Box sx={{
              position: 'absolute',
              left: `${((Number(r.sent) + Number(r.failed)) / max) * 100}%`, top: 0, bottom: 0,
              width: `${(Number(r.queued) / max) * 100}%`, bgcolor: 'warning.light',
            }} />
          </Box>
          <Typography variant="caption" sx={{ width: 56, textAlign: 'right' }}>
            {Number(r.total)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function HorizontalBars({ rows, formatLabel }) {
  if (!rows?.length) return null;
  const max = rows.reduce((m, r) => Math.max(m, Number(r.total) || 0), 0) || 1;
  const labelFor = typeof formatLabel === 'function' ? formatLabel : (l) => l;
  return (
    <Stack spacing={0.5} sx={{ width: '100%' }}>
      {rows.map((r, idx) => (
        <Stack key={`${r.label}-${idx}`} direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" sx={{ width: 200, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {labelFor(r.label)}
          </Typography>
          <Box sx={{ flex: 1, position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(Number(r.total) / max) * 100}%`, bgcolor: 'primary.light' }} />
          </Box>
          <Typography variant="caption" sx={{ width: 56, textAlign: 'right' }}>
            {Number(r.total)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function rowsToCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => esc(c.value(row))).join(',')).join('\n');
  return `${header}\n${body}`;
}

export default function PortalAdminNotificationReport() {
  const { t } = useTranslation();
  const { baseUrl, isAuthenticated, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const initialFrom = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const initialTo = useMemo(() => new Date(), []);

  const [fromInput, setFromInput] = useState(() => isoLocal(initialFrom));
  const [toInput, setToInput] = useState(() => isoLocal(initialTo));
  const [channel, setChannel] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeCode, setEventTypeCode] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [groupBy, setGroupBy] = useState('day');

  const [report, setReport] = useState(null);
  const [flowCatalog, setFlowCatalog] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const loadCatalog = useCallback(async () => {
    if (!canUseModule || flowCatalog.length > 0) return;
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const [flowsPayload, usersPayload] = await Promise.all([
        fetchAdminNotificationFlowDefaults(baseUrl, token, { emailHint }),
        fetchAdminNotificationOverrides(baseUrl, token, { emailHint, limit: 500 }),
      ]);
      setFlowCatalog(Array.isArray(flowsPayload?.flows) ? flowsPayload.flows : []);
      setRecipients(Array.isArray(usersPayload?.users) ? usersPayload.users : []);
    } catch {
      // best-effort — filters will simply offer fewer choices
    }
  }, [account, baseUrl, canUseModule, flowCatalog.length, getAccessToken]);

  const load = useCallback(async () => {
    if (!canUseModule) return;
    const fromMs = new Date(fromInput).getTime();
    const toMs = new Date(toInput).getTime();
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      setStatus('error');
      setError(t('portalAdminNotificationReport.errors.invalidDates'));
      return;
    }
    if (fromMs > toMs) {
      setStatus('error');
      setError(t('portalAdminNotificationReport.errors.invalidRange'));
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchAdminNotificationReport(baseUrl, token, {
        emailHint,
        from: new Date(fromInput).toISOString(),
        to: new Date(toInput).toISOString(),
        channel: channel || null,
        status: statusFilter || null,
        eventTypeCode: eventTypeCode || null,
        recipientUserId: recipientUserId || null,
        groupBy,
      });
      setReport(payload);
      setStatus('ok');
    } catch (loadError) {
      handleApiForbidden(loadError);
      setStatus('error');
      setError(t('portalAdminNotificationReport.errors.loadFailed'));
    }
  }, [account, baseUrl, canUseModule, channel, eventTypeCode, fromInput, getAccessToken, groupBy, handleApiForbidden, recipientUserId, statusFilter, t, toInput]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  useEffect(() => { void load(); }, [load]);

  const applyPreset = (hours) => {
    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    setFromInput(isoLocal(from));
    setToInput(isoLocal(to));
  };

  const downloadCsv = () => {
    if (!report) return;
    const rows =
      groupBy === 'day' || groupBy === 'hour'
        ? (Array.isArray(report.series) ? report.series : [])
        : (Array.isArray(report.aggregates) ? report.aggregates : []);
    if (!rows.length) return;
    const csv =
      groupBy === 'day' || groupBy === 'hour'
        ? rowsToCsv(rows, [
            { label: 'bucket', value: (r) => r.bucket },
            { label: 'total', value: (r) => r.total },
            { label: 'sent', value: (r) => r.sent },
            { label: 'failed', value: (r) => r.failed },
            { label: 'queued', value: (r) => r.queued },
          ])
        : rowsToCsv(rows, [
            { label: 'label', value: (r) => r.label },
            { label: 'total', value: (r) => r.total },
          ]);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-report-${groupBy}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = report?.summary;
  const latency = report?.latency_seconds;

  const hasExportableRows = useMemo(() => {
    if (!report) return false;
    if (groupBy === 'day' || groupBy === 'hour') {
      return Array.isArray(report.series) && report.series.length > 0;
    }
    return Array.isArray(report.aggregates) && report.aggregates.length > 0;
  }, [report, groupBy]);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        {status === 'loading' ? (
          <LinearProgress
            sx={{ borderRadius: 1 }}
            aria-busy="true"
            aria-label={t('portalAdminNotificationReport.actions.refresh')}
          />
        ) : null}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalAdminNotificationReport.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalAdminNotificationReport.intro')}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={t('portalAdminNotificationReport.actions.exportCsvHint')}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={downloadCsv}
                  disabled={!report || !hasExportableRows}
                >
                  {t('portalAdminNotificationReport.actions.exportCsv')}
                </Button>
              </span>
            </Tooltip>
            <PortalRefreshButton
              label={t('portalAdminNotificationReport.actions.refresh')}
              onClick={() => void load()}
              disabled={!canUseModule}
              loading={status === 'loading'}
            />
          </Stack>
        </Stack>

        <StatusAlertSlot
          message={isAuthenticated && !isAdmin
            ? { severity: 'error', text: t('portalAdminNotificationReport.errors.adminOnly') }
            : null}
        />
        <StatusAlertSlot message={status === 'error' ? { severity: 'error', text: error } : null} />

        <Paper variant="outlined" sx={{ p: 2 }} component="section" aria-label={t('portalAdminNotificationReport.filtersHeading')}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            {t('portalAdminNotificationReport.filtersHeading')}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {PRESET_RANGES.map((preset) => (
              <Chip
                key={preset.key}
                label={t(`portalAdminNotificationReport.presets.${preset.key}`)}
                onClick={() => applyPreset(preset.hours)}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label={t('portalAdminNotificationReport.filters.from')}
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label={t('portalAdminNotificationReport.filters.to')}
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                size="small"
                label={t('portalAdminNotificationReport.filters.channel')}
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                InputLabelProps={{ shrink: true }}
              >
                {CHANNELS.map((c) => (
                  <MenuItem key={c || 'any'} value={c}>
                    {channelFilterLabel(t, c)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                size="small"
                label={t('portalAdminNotificationReport.filters.status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              >
                {STATUSES.map((s) => (
                  <MenuItem key={s || 'any'} value={s}>
                    {s ? s : t('portalAdminNotificationReport.filters.anyStatus')}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                size="small"
                label={t('portalAdminNotificationReport.filters.groupBy')}
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                InputLabelProps={{ shrink: true }}
              >
                {GROUP_BY.map((g) => (
                  <MenuItem key={g} value={g}>
                    {t(`portalAdminNotificationReport.groupBy.${g}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label={t('portalAdminNotificationReport.filters.event')}
                value={eventTypeCode}
                onChange={(e) => setEventTypeCode(e.target.value)}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">{t('portalAdminNotificationReport.filters.anyEvent')}</MenuItem>
                {flowCatalog.map((f) => (
                  <MenuItem key={f.event_type_code} value={f.event_type_code}>
                    {t(f.label_key, f.event_type_code)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label={t('portalAdminNotificationReport.filters.recipient')}
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">{t('portalAdminNotificationReport.filters.anyRecipient')}</MenuItem>
                {recipients.map((u) => (
                  <MenuItem key={u.user_id} value={u.user_id}>
                    {`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || u.user_id}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Paper>

        {status === 'loading' && !report ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : !summary ? null : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard label={t('portalAdminNotificationReport.stats.total')} value={summary.total} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard label={t('portalAdminNotificationReport.stats.sent')} value={summary.sent} accent="success.main" />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard label={t('portalAdminNotificationReport.stats.failed')} value={summary.failed} accent="error.main" />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard label={t('portalAdminNotificationReport.stats.queued')} value={summary.queued} accent="warning.main" />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  label={t('portalAdminNotificationReport.stats.deliveryRate')}
                  value={
                    summary.delivery_rate === null
                      ? '—'
                      : `${(summary.delivery_rate * 100).toFixed(1)}%`
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  label={t('portalAdminNotificationReport.stats.uniqueRecipients')}
                  value={summary.unique_recipients}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  label={t('portalAdminNotificationReport.stats.latencyP50')}
                  value={latency?.p50 == null ? '—' : `${Number(latency.p50).toFixed(0)}s`}
                  subtitle={t('portalAdminNotificationReport.stats.latencyHint')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  label={t('portalAdminNotificationReport.stats.latencyP95')}
                  value={latency?.p95 == null ? '—' : `${Number(latency.p95).toFixed(0)}s`}
                />
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2 }} component="section">
              <Typography variant="h3" sx={{ fontSize: '1.05rem', mb: 1.5 }}>
                {(groupBy === 'day' || groupBy === 'hour')
                  ? t('portalAdminNotificationReport.charts.timeSeries')
                  : t(`portalAdminNotificationReport.charts.by_${groupBy}`)}
              </Typography>
              {(groupBy === 'day' || groupBy === 'hour') ? (
                report.series?.length ? (
                  <>
                    <MiniBarSeries rows={report.series} />
                    <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={t('portalAdminNotificationReport.legend.sent')} sx={{ bgcolor: 'success.light' }} />
                      <Chip size="small" label={t('portalAdminNotificationReport.legend.failed')} sx={{ bgcolor: 'error.light' }} />
                      <Chip size="small" label={t('portalAdminNotificationReport.legend.queued')} sx={{ bgcolor: 'warning.light' }} />
                    </Stack>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('portalAdminNotificationReport.chartEmpty')}
                  </Typography>
                )
              ) : (
                report.aggregates?.length ? (
                  <HorizontalBars
                    rows={report.aggregates}
                    formatLabel={
                      groupBy === 'channel'
                        ? (label) =>
                            label === 'UNKNOWN'
                              ? t('portalAdminNotificationReport.filters.unknownChannel')
                              : channelFilterLabel(t, label)
                        : undefined
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('portalAdminNotificationReport.chartEmpty')}
                  </Typography>
                )
              )}
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h3" sx={{ fontSize: '1.05rem', mb: 1.5 }}>
                    {t('portalAdminNotificationReport.charts.topRecipients')}
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('portalAdminNotificationReport.columns.recipient')}</TableCell>
                          <TableCell align="right">{t('portalAdminNotificationReport.columns.total')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(report.top_recipients || []).map((r, idx) => (
                          <TableRow key={r.user_id ? String(r.user_id) : `recipient-${r.email ?? 'unknown'}-${idx}`}>
                            <TableCell>
                              <Typography variant="body2">
                                {`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email || '—'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">{r.email}</Typography>
                            </TableCell>
                            <TableCell align="right">{r.total}</TableCell>
                          </TableRow>
                        ))}
                        {(report.top_recipients || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} align="center">
                              <Typography variant="caption" color="text.secondary">
                                {t('portalAdminNotificationReport.empty')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h3" sx={{ fontSize: '1.05rem', mb: 1.5 }}>
                    {t('portalAdminNotificationReport.charts.topFailing')}
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('portalAdminNotificationReport.columns.flow')}</TableCell>
                          <TableCell align="right">{t('portalAdminNotificationReport.columns.failures')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(report.top_failing_flows || []).map((r) => {
                          const meta = flowCatalog.find((f) => f.event_type_code === r.event_type_code);
                          return (
                            <TableRow key={r.event_type_code}>
                              <TableCell>
                                <Typography variant="body2">
                                  {meta ? t(meta.label_key, r.event_type_code) : r.event_type_code}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {r.event_type_code}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{r.total}</TableCell>
                            </TableRow>
                          );
                        })}
                        {(report.top_failing_flows || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} align="center">
                              <Typography variant="caption" color="text.secondary">
                                {t('portalAdminNotificationReport.empty')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Paper>
  );
}
