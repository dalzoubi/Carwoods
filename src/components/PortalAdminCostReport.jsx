import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { usePortalAuth } from '../PortalAuthContext';
import {
  fetchAdminCostRollup,
  fetchAdminCostLandlord,
  fetchAdminCostsPricing,
  patchAdminCostsPricing,
} from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function fmtUsd(value) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function subtractDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { key: '7d', labelKey: 'portalAdminCostReport.presets.last7d', days: 7 },
  { key: '30d', labelKey: 'portalAdminCostReport.presets.last30d', days: 30 },
  { key: '90d', labelKey: 'portalAdminCostReport.presets.last90d', days: 90 },
  { key: 'custom', labelKey: 'portalAdminCostReport.presets.custom', days: null },
];

function emailFromAccount(account) {
  return account?.username ?? account?.idTokenClaims?.email ?? '';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MarginChip({ marginUsd, atRisk, t }) {
  if (marginUsd == null) return <Typography variant="caption" color="text.secondary">{t('portalAdminCostReport.noRate')}</Typography>;
  if (atRisk) {
    return (
      <Chip
        size="small"
        color="error"
        icon={<WarningAmberOutlined />}
        label={`${fmtUsd(marginUsd)}`}
        sx={{ fontWeight: 600 }}
      />
    );
  }
  return (
    <Chip
      size="small"
      color="success"
      label={fmtUsd(marginUsd)}
    />
  );
}

function DrilldownPanel({ landlordId, from, to, baseUrl, accessToken, emailHint, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetchAdminCostLandlord(baseUrl, accessToken, landlordId, { emailHint, from, to })
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [landlordId, from, to, baseUrl, accessToken, emailHint]);

  if (loading) return <Box sx={{ px: 2, py: 1 }}><CircularProgress size={18} /></Box>;
  if (!data) return null;

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
        {/* By service */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('portalAdminCostReport.byService')}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('portalAdminCostReport.cols.service')}</TableCell>
                <TableCell align="right">{t('portalAdminCostReport.cols.cost')}</TableCell>
                <TableCell align="right">{t('portalAdminCostReport.cols.events')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.by_service.map((row) => (
                <TableRow key={row.service} hover>
                  <TableCell><code>{row.service}</code></TableCell>
                  <TableCell align="right">{fmtUsd(row.total_cost_usd)}</TableCell>
                  <TableCell align="right">{Number(row.event_count).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {data.by_service.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{t('portalAdminCostReport.noData')}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {/* By property */}
        {data.by_property.length > 0 && (
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('portalAdminCostReport.byProperty')}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('portalAdminCostReport.cols.property')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.cost')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.by_property.map((row) => (
                  <TableRow key={row.property_id} hover>
                    <TableCell>{row.property_label ?? t('portalAdminCostReport.unattributed')}</TableCell>
                    <TableCell align="right">{fmtUsd(row.total_cost_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function PricingConfigPanel({ baseUrl, accessToken, emailHint, t, showFeedback }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchAdminCostsPricing(baseUrl, accessToken, { emailHint })
      .then((d) => { if (!cancelled) setRows(d.pricing); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [baseUrl, accessToken, emailHint]);

  const handleEdit = (id, currentRate) => {
    setEditing((prev) => ({ ...prev, [id]: String(currentRate) }));
  };

  const handleCancel = (id) => {
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSave = async (id) => {
    const rateStr = editing[id];
    const rate = parseFloat(rateStr);
    if (!Number.isFinite(rate) || rate < 0) {
      showFeedback(t('portalAdminCostReport.pricing.invalidRate'), 'error');
      return;
    }
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const updated = await patchAdminCostsPricing(baseUrl, accessToken, id, { emailHint, rate_usd: rate });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, rate_usd: updated.rate_usd } : r)));
      setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
      showFeedback(t('portalAdminCostReport.pricing.saved'), 'success');
    } catch {
      showFeedback(t('portalAdminCostReport.pricing.saveFailed'), 'error');
    } finally {
      setSaving((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  if (loading) return <LinearProgress />;
  if (!rows) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h3" sx={{ fontSize: '1rem', mb: 1.5, fontWeight: 600 }}>
        {t('portalAdminCostReport.pricing.heading')}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('portalAdminCostReport.pricing.service')}</TableCell>
            <TableCell>{t('portalAdminCostReport.pricing.unitType')}</TableCell>
            <TableCell>{t('portalAdminCostReport.pricing.rateUsd')}</TableCell>
            <TableCell>{t('portalAdminCostReport.pricing.description')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const isEditing = id => editing[id] !== undefined;
            const isSaving = saving[row.id];
            return (
              <TableRow key={row.id} hover>
                <TableCell><code>{row.service}</code></TableCell>
                <TableCell>{row.unit_type}</TableCell>
                <TableCell>
                  {isEditing(row.id) ? (
                    <TextField
                      size="small"
                      value={editing[row.id]}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      inputProps={{ inputMode: 'decimal' }}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      sx={{ width: 130 }}
                    />
                  ) : (
                    <Typography variant="body2">{fmtUsd(row.rate_usd)}</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{row.description}</TableCell>
                <TableCell align="right">
                  {isEditing(row.id) ? (
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={isSaving}
                        onClick={() => handleSave(row.id)}
                      >
                        {isSaving ? <CircularProgress size={14} /> : t('portalAdminCostReport.pricing.save')}
                      </Button>
                      <Button size="small" onClick={() => handleCancel(row.id)} disabled={isSaving}>
                        {t('portalAdminCostReport.pricing.cancel')}
                      </Button>
                    </Stack>
                  ) : (
                    <Button size="small" onClick={() => handleEdit(row.id, row.rate_usd)}>
                      {t('portalAdminCostReport.pricing.edit')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PortalAdminCostReport() {
  const { t } = useTranslation();
  const { baseUrl, isAuthenticated, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState(() => subtractDays(30));
  const [customTo, setCustomTo] = useState(() => todayUtc());
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('idle');
  const [expandedId, setExpandedId] = useState(null);
  const [token, setToken] = useState(null);

  const emailHint = emailFromAccount(account);
  const canUse = isAuthenticated && Boolean(baseUrl);

  const activePreset = PRESETS.find((p) => p.key === preset);
  const from = preset === 'custom' ? customFrom : subtractDays(activePreset?.days ?? 30);
  const to = preset === 'custom' ? customTo : todayUtc();

  const load = useCallback(async () => {
    if (!canUse) return;
    setStatus('loading');
    setReport(null);
    setExpandedId(null);
    try {
      const tok = await getAccessToken();
      setToken(tok);
      const data = await fetchAdminCostRollup(baseUrl, tok, { emailHint, from, to });
      setReport(data);
      setStatus('ok');
    } catch (err) {
      handleApiForbidden(err);
      setStatus('error');
    }
  }, [canUse, baseUrl, getAccessToken, emailHint, from, to, handleApiForbidden]);

  useEffect(() => { void load(); }, [load]);

  const totalCost = report?.landlords?.reduce((s, l) => s + (l.total_cost_usd ?? 0), 0) ?? 0;
  const atRiskCount = report?.landlords?.filter((l) => l.at_risk).length ?? 0;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2.5}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h2" sx={{ fontSize: '1.25rem', flex: 1 }}>
            {t('portalAdminCostReport.heading')}
          </Typography>
          <Tooltip title={t('portalAdminCostReport.refresh')}>
            <span>
              <IconButton onClick={load} disabled={status === 'loading'} size="small" type="button">
                <RefreshOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* Time window picker */}
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <ButtonGroup size="small" variant="outlined">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  variant={preset === p.key ? 'contained' : 'outlined'}
                  onClick={() => setPreset(p.key)}
                >
                  {t(p.labelKey)}
                </Button>
              ))}
            </ButtonGroup>
            {preset === 'custom' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  type="date"
                  label={t('portalAdminCostReport.from')}
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 155 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label={t('portalAdminCostReport.to')}
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 155 }}
                />
                <Button type="button" variant="contained" size="small" onClick={load} disabled={status === 'loading'}>
                  {t('portalAdminCostReport.apply')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>

        {status === 'loading' && <LinearProgress />}

        {status === 'error' && (
          <Typography color="error" variant="body2">{t('portalAdminCostReport.loadError')}</Typography>
        )}

        {/* Summary chips */}
        {report && status === 'ok' && (
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Chip
              label={`${t('portalAdminCostReport.totalCost')}: ${fmtUsd(totalCost)}`}
              color="default"
              size="small"
            />
            <Chip
              label={`${report.landlords.length} ${t('portalAdminCostReport.landlords')}`}
              color="default"
              size="small"
            />
            {atRiskCount > 0 && (
              <Chip
                icon={<WarningAmberOutlined />}
                label={`${atRiskCount} ${t('portalAdminCostReport.atRisk')}`}
                color="error"
                size="small"
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {from} → {to} ({report.days} {t('portalAdminCostReport.days')})
            </Typography>
          </Stack>
        )}

        {/* Overview table */}
        {status === 'ok' && report && (
          <Paper variant="outlined" sx={{ overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t('portalAdminCostReport.cols.landlord')}</TableCell>
                  <TableCell>{t('portalAdminCostReport.cols.tier')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.properties')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.totalCost')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.email')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.sms')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.ai')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.revenue')}</TableCell>
                  <TableCell align="right">{t('portalAdminCostReport.cols.margin')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.landlords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>
                      {t('portalAdminCostReport.noData')}
                    </TableCell>
                  </TableRow>
                )}
                {report.landlords.map((row) => {
                  const expanded = expandedId === row.landlord_id;
                  return (
                    <React.Fragment key={row.landlord_id}>
                      <TableRow
                        hover
                        sx={{ cursor: 'pointer', '& td': { borderBottom: expanded ? 0 : undefined } }}
                        onClick={() => setExpandedId(expanded ? null : row.landlord_id)}
                      >
                        <TableCell padding="checkbox">
                          <IconButton size="small" type="button">
                            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={row.at_risk ? 600 : 400}>
                            {row.landlord_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{row.landlord_email}</Typography>
                        </TableCell>
                        <TableCell>
                          {row.tier_name ? (
                            <Chip
                              size="small"
                              label={row.tier_name === 'PRO' ? 'PRO' : t('portalAdminCostReport.payg')}
                              color={row.tier_name === 'PRO' ? 'primary' : 'default'}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{row.property_count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtUsd(row.total_cost_usd)}</TableCell>
                        <TableCell align="right">{fmtUsd(row.email_cost_usd)}</TableCell>
                        <TableCell align="right">{fmtUsd(row.sms_cost_usd)}</TableCell>
                        <TableCell align="right">{fmtUsd(row.ai_cost_usd)}</TableCell>
                        <TableCell align="right">{fmtUsd(row.estimated_revenue_usd)}</TableCell>
                        <TableCell align="right">
                          <MarginChip marginUsd={row.margin_usd} atRisk={row.at_risk} t={t} />
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell colSpan={10} sx={{ p: 0 }}>
                            <Collapse in={expanded} unmountOnExit>
                              <DrilldownPanel
                                landlordId={row.landlord_id}
                                from={from}
                                to={to}
                                baseUrl={baseUrl}
                                accessToken={token}
                                emailHint={emailHint}
                                t={t}
                              />
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}

        <Divider />

        {/* Pricing config panel */}
        {canUse && token && (
          <PricingConfigPanel
            baseUrl={baseUrl}
            accessToken={token}
            emailHint={emailHint}
            t={t}
            showFeedback={showFeedback}
          />
        )}
      </Stack>

      <PortalFeedbackSnackbar
        open={feedback.open}
        message={feedback.message}
        severity={feedback.severity}
        onClose={closeFeedback}
        autoHideDuration={feedback.autoHideDuration}
      />
    </Paper>
  );
}
