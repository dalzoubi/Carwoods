import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import ContactMail from '@mui/icons-material/ContactMail';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../LanguageContext';
import { usePortalAuth } from '../PortalAuthContext';
import { relativeTime } from '../lib/notificationUtils';
import useHighlightRow from '../lib/useHighlightRow';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalConfirmDialog from './PortalConfirmDialog';
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';
import {
  fetchAdminContactRequests,
  patchAdminContactRequestStatus,
  deleteAdminContactRequest,
} from '../lib/portalApiClient';
import MailtoEmailLink from './MailtoEmailLink';
import EmptyState from './EmptyState';
import PortalAdminContactReplyThread from './PortalAdminContactReplyThread';

const UUID_HASH_RE = /^#[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fixed leading column so “select all” and row checkboxes share one vertical axis (LTR + RTL). */
const CONTACT_HEADER_CHECKBOX_COL_SX = {
  flexShrink: 0,
  width: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const CONTACT_ROW_CHECKBOX_COL_SX = {
  flexShrink: 0,
  width: 48,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  pt: 1.25,
};

function statusColor(status) {
  if (status === 'UNREAD') return 'error';
  if (status === 'HANDLED') return 'success';
  return 'default';
}

function subjectTranslationKey(subject) {
  const map = {
    GENERAL: 'general',
    RENTER: 'renter',
    PROPERTY_OWNER: 'propertyOwner',
    PORTAL_SAAS: 'portalSaas',
    PAID_SUBSCRIPTION: 'paidSubscription',
    PRICING_PAY_AS_YOU_GROW: 'paidSubscription',
    PRICING_PRO: 'paidSubscription',
  };
  return map[String(subject ?? '').toUpperCase()] ?? 'general';
}

export default function PortalAdminContactRequests() {
  const { t, i18n } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { hash } = useLocation();
  const { baseUrl, account, getAccessToken, handleApiForbidden } = usePortalAuth();
  const emailHint = account?.username || undefined;
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const [filter, setFilter] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [detailRow, setDetailRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [highlightTargetId, setHighlightTargetId] = useState(null);
  const [highlightAnnouncement, setHighlightAnnouncement] = useState('');
  const hlAttemptedRef = useRef(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!baseUrl) {
      if (!silent) setLoading(false);
      setRows([]);
      setTotal(0);
      setUnreadCount(0);
      setLoadError('');
      return;
    }
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const token = await getAccessToken();
      const data = await fetchAdminContactRequests(baseUrl, token, {
        status: filter,
        emailHint,
      });
      setRows(data.contact_requests ?? []);
      setTotal(data.total ?? 0);
      setUnreadCount(data.unread_count ?? 0);
    } catch (err) {
      handleApiForbidden(err);
      setLoadError(t('portalAdminContactRequests.errors.loadFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [baseUrl, emailHint, filter, getAccessToken, handleApiForbidden, t]);

  const handleRefresh = useCallback(async () => {
    if (!baseUrl) return;
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [baseUrl, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)));
  }, [rows]);

  useEffect(() => {
    const h = String(hash ?? '').trim();
    if (!h || !UUID_HASH_RE.test(h)) {
      setHighlightTargetId(null);
      hlAttemptedRef.current = false;
      return;
    }
    if (loading) return;

    const id = h.slice(1);
    const row = rows.find((r) => String(r.id).toLowerCase() === id.toLowerCase());

    if (!row) {
      if (!hlAttemptedRef.current && filter !== 'ALL') {
        hlAttemptedRef.current = true;
        setFilter('ALL');
      }
      return;
    }

    setHighlightAnnouncement(
      t('portalAdminContactRequests.highlightAnnouncement', {
        name: String(row.name || row.email || '').trim() || row.id,
      })
    );
    setHighlightTargetId(row.id);
  }, [hash, rows, loading, filter, t]);

  const { flashId: contactFlashId, ariaAnnouncement, getRowProps: getContactRowProps } = useHighlightRow({
    targetId: highlightTargetId,
    elementIdFor: (id) => `contact-request-row-${id}`,
    announcement: highlightAnnouncement,
    durationMs: 6000,
    ready: !loading,
  });

  const visibleIds = rows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0
    && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

  const toggleRowSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const clearRowSelection = () => setSelectedIds([]);

  const handleStatusChange = async (row, newStatus) => {
    if (!baseUrl) return;
    setSaving(true);
    setSaveError('');
    try {
      const token = await getAccessToken();
      await patchAdminContactRequestStatus(baseUrl, token, {
        requestId: row.id,
        status: newStatus,
        emailHint,
      });
      showFeedback(t('portalAdminContactRequests.feedback.statusUpdated', { status: newStatus }));
      setDetailRow(null);
      void load();
    } catch (err) {
      handleApiForbidden(err);
      setSaveError(t('portalAdminContactRequests.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    const ids = [...selectedIds];
    if (!baseUrl || ids.length === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const token = await getAccessToken();
      const results = await Promise.allSettled(
        ids.map((requestId) => patchAdminContactRequestStatus(baseUrl, token, {
          requestId,
          status: newStatus,
          emailHint,
        }))
      );
      const updatedOk = ids.filter((id, i) => results[i].status === 'fulfilled');
      const failed = results.length - updatedOk.length;
      if (failed > 0) {
        showFeedback(
          t('portalAdminContactRequests.feedback.bulkPartialFailure', { failed, total: ids.length }),
          'error'
        );
      } else {
        showFeedback(
          t('portalAdminContactRequests.feedback.bulkStatusUpdated', { count: ids.length, status: newStatus })
        );
      }
      if (failed === 0) {
        setSelectedIds([]);
      }
      setDetailRow((d) => (d && updatedOk.includes(d.id) ? null : d));
      void load({ silent: true });
    } catch (err) {
      handleApiForbidden(err);
      setSaveError(t('portalAdminContactRequests.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDeleteConfirmed = async () => {
    const ids = [...selectedIds];
    if (!baseUrl || ids.length === 0) return;
    setDeleting(true);
    setSaveError('');
    try {
      const token = await getAccessToken();
      const results = await Promise.allSettled(
        ids.map((requestId) => deleteAdminContactRequest(baseUrl, token, { requestId, emailHint }))
      );
      const deletedOk = ids.filter((id, i) => results[i].status === 'fulfilled');
      const failed = results.length - deletedOk.length;
      if (failed > 0) {
        showFeedback(
          t('portalAdminContactRequests.feedback.bulkDeletePartialFailure', { failed, total: ids.length }),
          'error'
        );
      } else {
        showFeedback(t('portalAdminContactRequests.feedback.bulkDeleted', { count: ids.length }));
        setSelectedIds([]);
      }
      setBulkDeleteConfirmOpen(false);
      setDetailRow((d) => (d && deletedOk.includes(d.id) ? null : d));
      void load({ silent: true });
    } catch (err) {
      handleApiForbidden(err);
      showFeedback(t('portalAdminContactRequests.errors.deleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!detailRow || !baseUrl) return;
    setDeleting(true);
    setSaveError('');
    try {
      const token = await getAccessToken();
      await deleteAdminContactRequest(baseUrl, token, {
        requestId: detailRow.id,
        emailHint,
      });
      showFeedback(t('portalAdminContactRequests.feedback.deleted'));
      setDeleteConfirmOpen(false);
      setDetailRow(null);
      setSelectedIds((prev) => prev.filter((id) => id !== detailRow.id));
      void load();
    } catch (err) {
      handleApiForbidden(err);
      showFeedback(t('portalAdminContactRequests.errors.deleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(currentLanguage, { dateStyle: 'medium', timeStyle: 'short' }),
    [currentLanguage]
  );
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return dateTimeFormatter.format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const subjectLabel = (subject) =>
    t(`contact.subjects.${subjectTranslationKey(subject)}`);

  return (
    <Box>
      <Helmet>
        <title>{t('portalAdminContactRequests.title')}</title>
      </Helmet>

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />

      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {ariaAnnouncement}
      </Box>

      <StatusAlertSlot
        message={
          !baseUrl
            ? { severity: 'warning', text: t('portalAdminContactRequests.errors.apiUnavailable') }
            : null
        }
      />

      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        mb={2}
        flexWrap="wrap"
        gap={1}
      >
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Typography variant="h6" fontWeight={600}>
            {t('portalAdminContactRequests.heading')}
          </Typography>
          {!loading && (
            <Typography variant="body2" color="text.secondary">
              {unreadCount > 0
                ? t('portalAdminContactRequests.unreadBadge', { count: unreadCount })
                : t('portalAdminContactRequests.intro')}
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ flexShrink: 0 }}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            disabled={!baseUrl}
            onChange={(_, v) => {
              if (v) setFilter(v);
            }}
            size="small"
          >
            <ToggleButton value="ALL">{t('portalAdminContactRequests.filterAll')}</ToggleButton>
            <ToggleButton value="UNREAD">{t('portalAdminContactRequests.filterUnread')}</ToggleButton>
            <ToggleButton value="READ">{t('portalAdminContactRequests.filterRead')}</ToggleButton>
            <ToggleButton value="HANDLED">{t('portalAdminContactRequests.filterHandled')}</ToggleButton>
          </ToggleButtonGroup>
          <PortalRefreshButton
            label={t('portalAdminContactRequests.refresh')}
            onClick={() => { void handleRefresh(); }}
            disabled={!baseUrl}
            loading={refreshing}
          />
        </Stack>
      </Stack>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={28} />
        </Box>
      ) : loadError ? (
        <Alert severity="error">{loadError}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ContactMail sx={{ fontSize: 56 }} />}
          title={t('portalAdminContactRequests.noRequests')}
        />
      ) : (
        <>
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" alignItems="center" gap={1} sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <Box sx={CONTACT_HEADER_CHECKBOX_COL_SX}>
                <Checkbox
                  edge="start"
                  size="small"
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  checked={allVisibleSelected}
                  onChange={handleSelectAllVisible}
                  disabled={saving || deleting}
                  inputProps={{
                    'aria-label': t('portalAdminContactRequests.selectAllAria'),
                  }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
                {selectedIds.length > 0
                  ? t('portalAdminContactRequests.selectedCount', { count: selectedIds.length })
                  : t('portalAdminContactRequests.selectVisibleHint')}
              </Typography>
            </Stack>
            {selectedIds.length > 0 && (
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
                <Button
                  type="button"
                  size="small"
                  onClick={clearRowSelection}
                  disabled={saving || deleting}
                >
                  {t('portalAdminContactRequests.clearSelection')}
                </Button>
                <Button
                  type="button"
                  size="small"
                  onClick={() => { void handleBulkStatusChange('READ'); }}
                  disabled={saving || deleting}
                >
                  {t('portalAdminContactRequests.bulkMarkAsRead')}
                </Button>
                <Button
                  type="button"
                  size="small"
                  onClick={() => { void handleBulkStatusChange('HANDLED'); }}
                  disabled={saving || deleting}
                >
                  {t('portalAdminContactRequests.bulkMarkAsHandled')}
                </Button>
                <Button
                  type="button"
                  size="small"
                  color="error"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  disabled={saving || deleting}
                >
                  {t('portalAdminContactRequests.bulkDelete')}
                </Button>
              </Stack>
            )}
          </Stack>
        <List disablePadding>
          {rows.map((row, idx) => {
            const isUnread = row.status === 'UNREAD';
            const isHi = contactFlashId != null && String(row.id) === String(contactFlashId);
            const rowLabel = String(row.name || row.email || row.id || '').trim() || row.id;
            return (
              <React.Fragment key={row.id}>
                {idx > 0 && <Divider />}
                <ListItem
                  disablePadding
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Box sx={CONTACT_ROW_CHECKBOX_COL_SX}>
                    <Checkbox
                      edge="start"
                      size="small"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRowSelected(row.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={saving || deleting}
                      inputProps={{
                        'aria-label': t('portalAdminContactRequests.selectRowAria', { name: rowLabel }),
                      }}
                    />
                  </Box>
                  <ListItemButton
                    id={`contact-request-row-${row.id}`}
                    {...getContactRowProps(row.id)}
                    onClick={() => setDetailRow(row)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      px: 2,
                      py: 1.5,
                      gap: 1.5,
                      alignItems: 'flex-start',
                      borderRadius: 1,
                      backgroundColor: isHi ? 'action.selected' : (isUnread ? 'action.hover' : 'transparent'),
                      boxShadow: isHi ? (theme) => `0 0 0 2px ${theme.palette.primary.main}` : 'none',
                      transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        backgroundColor: isUnread ? 'action.selected' : 'action.hover',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        mt: 0.25,
                        color: isUnread ? 'primary.main' : 'text.disabled',
                        flexShrink: 0,
                      }}
                    >
                      <ContactMail fontSize="small" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        gap={1}
                        flexWrap="wrap"
                        sx={{ mb: 0.25 }}
                      >
                        <Typography variant="body2" fontWeight={isUnread ? 700 : 400}>
                          {subjectLabel(row.subject)}
                        </Typography>
                        <Chip
                          label={row.status}
                          color={statusColor(row.status)}
                          size="small"
                          sx={{ height: 22 }}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 0.25 }}>
                        {row.name}
                        {' · '}
                        <MailtoEmailLink
                          email={row.email}
                          color="inherit"
                          stopPropagation
                          sx={{ color: 'inherit' }}
                        />
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {row.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                        {row.created_at ? relativeTime(row.created_at, i18n.language) : ''}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
        </>
      )}

      {!loading && !loadError && rows.length > 0 && total > rows.length && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('portalAdminContactRequests.showingCount', { shown: rows.length, total })}
        </Typography>
      )}

      <Dialog
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        maxWidth="md"
        fullWidth
      >
        {detailRow && (
          <>
            <DialogTitle>{t('portalAdminContactRequests.detailDialogTitle')}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>
                    {t('portalAdminContactRequests.fieldFrom')}
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                    {detailRow.name}
                    {' '}
                    &lt;
                    <MailtoEmailLink email={detailRow.email} />
                    &gt;
                  </Typography>
                </Stack>
                {detailRow.phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>
                      {t('contact.phoneLabel')}
                    </Typography>
                    <Typography variant="body2">{detailRow.phone}</Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>
                    {t('contact.subjectLabel')}
                  </Typography>
                  <Typography variant="body2">{subjectLabel(detailRow.subject)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>
                    {t('portalAdminContactRequests.fieldDate')}
                  </Typography>
                  <Typography variant="body2">{formatDate(detailRow.created_at)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>
                    {t('portalAdminContactRequests.columnStatus')}
                  </Typography>
                  <Chip label={detailRow.status} color={statusColor(detailRow.status)} size="small" />
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('contact.messageLabel')}
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 0.5,
                      p: 1.5,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {detailRow.message}
                    </Typography>
                  </Paper>
                </Box>
                <Divider sx={{ my: 1 }} />
                <PortalAdminContactReplyThread
                  baseUrl={baseUrl}
                  accessToken={getAccessToken}
                  emailHint={emailHint}
                  contactRequest={detailRow}
                  onReplySent={({ contactRequest, emailDelivered, emailError, isInternalNote }) => {
                    if (contactRequest) {
                      setDetailRow(contactRequest);
                    }
                    if (isInternalNote) {
                      showFeedback(t('portalAdminContactRequests.reply.feedbackInternalSaved'));
                    } else if (emailDelivered) {
                      showFeedback(t('portalAdminContactRequests.reply.feedbackReplySent'));
                    } else {
                      showFeedback(
                        t('portalAdminContactRequests.reply.feedbackReplySavedNoEmail', {
                          reason: emailError || 'unknown',
                        }),
                        'warning'
                      );
                    }
                    void load({ silent: true });
                  }}
                  onError={(err) => handleApiForbidden(err)}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => setDetailRow(null)} size="small" color="inherit">
                {t('portalAdminContactRequests.close')}
              </Button>
              <Button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                size="small"
                color="error"
                disabled={saving || deleting}
              >
                {t('portalAdminContactRequests.delete')}
              </Button>
              {detailRow.status !== 'READ' && (
                <Button
                  type="button"
                  onClick={() => handleStatusChange(detailRow, 'READ')}
                  size="small"
                  disabled={saving}
                >
                  {t('portalAdminContactRequests.markAsRead')}
                </Button>
              )}
              {detailRow.status !== 'HANDLED' && (
                <Button
                  type="button"
                  onClick={() => handleStatusChange(detailRow, 'HANDLED')}
                  variant="contained"
                  size="small"
                  disabled={saving}
                >
                  {t('portalAdminContactRequests.markAsHandled')}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <PortalConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          void handleDeleteConfirmed();
        }}
        title={t('portalAdminContactRequests.deleteConfirmTitle')}
        body={t('portalAdminContactRequests.deleteConfirmBody')}
        confirmLabel={t('portalAdminContactRequests.deleteConfirmAction')}
        cancelLabel={t('portalAdminContactRequests.deleteCancel')}
        confirmColor="error"
        loading={deleting}
      />

      <PortalConfirmDialog
        open={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={() => {
          void handleBulkDeleteConfirmed();
        }}
        title={t('portalAdminContactRequests.bulkDeleteConfirmTitle', { count: selectedIds.length })}
        body={t('portalAdminContactRequests.bulkDeleteConfirmBody', { count: selectedIds.length })}
        confirmLabel={t('portalAdminContactRequests.bulkDeleteConfirmAction')}
        cancelLabel={t('portalAdminContactRequests.deleteCancel')}
        confirmColor="error"
        loading={deleting}
      />
    </Box>
  );
}
