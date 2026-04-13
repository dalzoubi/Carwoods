import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Heading } from '../styles';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function statusColor(status) {
  if (status === 'UNREAD') return 'error';
  if (status === 'HANDLED') return 'success';
  return 'default';
}

function subjectLabel(subject) {
  const map = {
    GENERAL: 'General',
    RENTER: 'Renter',
    PROPERTY_OWNER: 'Property Owner',
    PORTAL_SAAS: 'Portal/SaaS',
  };
  return map[subject] ?? subject;
}

export default function PortalAdminContactRequests() {
  const { t } = useTranslation();
  const { getAccessToken } = usePortalAuth();

  const [filter, setFilter] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const token = await getAccessToken();
      const params = filter !== 'ALL' ? `?status=${filter}` : '';
      const resp = await fetch(`${API_BASE}/api/portal/admin/contact-requests${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setRows(data.contact_requests ?? []);
      setTotal(data.total ?? 0);
      setUnreadCount(data.unread_count ?? 0);
    } catch (err) {
      setLoadError(t('portalAdminContactRequests.errors.loadFailed', 'Failed to load contact requests.'));
    } finally {
      setLoading(false);
    }
  }, [filter, getAccessToken, t]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (row, newStatus) => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const token = await getAccessToken();
      const resp = await fetch(`${API_BASE}/api/portal/admin/contact-requests/${row.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setSaveSuccess(`Marked as ${newStatus.toLowerCase()}`);
      setSelected(null);
      load();
    } catch {
      setSaveError(t('portalAdminContactRequests.errors.saveFailed', 'Failed to update status.'));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <Box>
      <Helmet>
        <title>{t('portalAdminContactRequests.title', 'Carwoods Portal — Contact Requests')}</title>
      </Helmet>

      <Heading>{t('portalAdminContactRequests.heading', 'Contact Requests')}</Heading>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('portalAdminContactRequests.intro', 'Inquiries submitted through the contact form appear here.')}
        {unreadCount > 0 && (
          <Box component="span" sx={{ ml: 1, fontWeight: 700, color: 'error.main' }}>
            {unreadCount} unread
          </Box>
        )}
      </Typography>

      {saveSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess('')}>{saveSuccess}</Alert>}
      {saveError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>{saveError}</Alert>}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => { if (v) setFilter(v); }}
          size="small"
        >
          <ToggleButton value="ALL">{t('portalAdminContactRequests.filterAll', 'All')}</ToggleButton>
          <ToggleButton value="UNREAD">{t('portalAdminContactRequests.filterUnread', 'Unread')}</ToggleButton>
          <ToggleButton value="READ">{t('portalAdminContactRequests.filterRead', 'Read')}</ToggleButton>
          <ToggleButton value="HANDLED">{t('portalAdminContactRequests.filterHandled', 'Handled')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : loadError ? (
        <Alert severity="error">{loadError}</Alert>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('portalAdminContactRequests.noRequests', 'No contact requests found.')}
        </Typography>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('portalAdminContactRequests.columnDate', 'Date')}</TableCell>
                <TableCell>{t('portalAdminContactRequests.columnName', 'Name')}</TableCell>
                <TableCell>{t('portalAdminContactRequests.columnEmail', 'Email')}</TableCell>
                <TableCell>{t('portalAdminContactRequests.columnSubject', 'Subject')}</TableCell>
                <TableCell>{t('portalAdminContactRequests.columnStatus', 'Status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => setSelected(row)}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: row.status === 'UNREAD' ? 700 : 400,
                    '& td': { fontWeight: row.status === 'UNREAD' ? 700 : 400 },
                  }}
                >
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{subjectLabel(row.subject)}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.status}
                      color={statusColor(row.status)}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
      >
        {selected && (
          <>
            <DialogTitle>{t('portalAdminContactRequests.detailDialogTitle', 'Contact Request')}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>From</Typography>
                  <Typography variant="body2">{selected.name} &lt;{selected.email}&gt;</Typography>
                </Stack>
                {selected.phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>Phone</Typography>
                    <Typography variant="body2">{selected.phone}</Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>Subject</Typography>
                  <Typography variant="body2">{subjectLabel(selected.subject)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>Date</Typography>
                  <Typography variant="body2">{formatDate(selected.created_at)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>Status</Typography>
                  <Chip label={selected.status} color={statusColor(selected.status)} size="small" />
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Message</Typography>
                  <Paper elevation={0} sx={{ mt: 0.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selected.message}</Typography>
                  </Paper>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
              <Button onClick={() => setSelected(null)} size="small" color="inherit">Close</Button>
              {selected.status !== 'READ' && (
                <Button
                  onClick={() => handleStatusChange(selected, 'READ')}
                  size="small"
                  disabled={saving}
                >
                  {t('portalAdminContactRequests.markAsRead', 'Mark as Read')}
                </Button>
              )}
              {selected.status !== 'HANDLED' && (
                <Button
                  onClick={() => handleStatusChange(selected, 'HANDLED')}
                  variant="contained"
                  size="small"
                  disabled={saving}
                >
                  {t('portalAdminContactRequests.markAsHandled', 'Mark as Handled')}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
