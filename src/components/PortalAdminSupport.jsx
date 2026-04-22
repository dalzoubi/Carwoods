import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { fetchAdminSupportTickets } from '../lib/portalApiClient';
import SupportTicketAdminDetail from './portalSupport/SupportTicketAdminDetail';
import {
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_AREAS,
  SUPPORT_TICKET_PRIORITIES,
} from '../supportTicketConstants';

function formatDateTime(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString(); } catch { return String(s); }
}

function statusColor(status) {
  if (status === 'OPEN') return 'info';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'RESOLVED') return 'success';
  return 'default';
}

export default function PortalAdminSupport() {
  const { t } = useTranslation();
  const { baseUrl, getAccessToken, meData, account } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'OPEN');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterPriority, setFilterPriority] = useState(searchParams.get('priority') || '');
  const [filterArea, setFilterArea] = useState(searchParams.get('area') || '');
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState('loading');
  const [errorCode, setErrorCode] = useState('');
  const selectedId = searchParams.get('id') || '';

  const load = useCallback(async () => {
    setState('loading');
    try {
      const accessToken = await getAccessToken();
      const data = await fetchAdminSupportTickets(baseUrl, accessToken, {
        emailHint,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        priority: filterPriority || undefined,
        area: filterArea || undefined,
      });
      setTickets(data.tickets ?? []);
      setTotal(Number(data.total ?? 0));
      setState('loaded');
    } catch (err) {
      setErrorCode(err?.code || 'load_failed');
      setState('error');
    }
  }, [baseUrl, emailHint, getAccessToken, filterStatus, filterCategory, filterPriority, filterArea]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: false });
  };
  const closeDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: false });
    load();
  };

  const statusOptions = useMemo(() => ['', ...SUPPORT_TICKET_STATUSES], []);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>{t('portalSupport.admin.pageTitle')}</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="admin-filter-status">{t('portalSupport.admin.status')}</InputLabel>
            <Select
              labelId="admin-filter-status"
              label={t('portalSupport.admin.status')}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {statusOptions.map((s) => (
                <MenuItem key={s || 'all'} value={s}>
                  {s ? t(`portalSupport.statuses.${s}`) : t('portalSupport.filters.all')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="admin-filter-category">{t('portalSupport.admin.category')}</InputLabel>
            <Select
              labelId="admin-filter-category"
              label={t('portalSupport.admin.category')}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="">{t('portalSupport.filters.all')}</MenuItem>
              {SUPPORT_TICKET_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{t(`portalSupport.categories.${c}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="admin-filter-priority">{t('portalSupport.admin.priority')}</InputLabel>
            <Select
              labelId="admin-filter-priority"
              label={t('portalSupport.admin.priority')}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <MenuItem value="">{t('portalSupport.filters.all')}</MenuItem>
              {SUPPORT_TICKET_PRIORITIES.map((p) => (
                <MenuItem key={p} value={p}>{t(`portalSupport.priorities.${p}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="admin-filter-area">{t('portalSupport.admin.area')}</InputLabel>
            <Select
              labelId="admin-filter-area"
              label={t('portalSupport.admin.area')}
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
            >
              <MenuItem value="">{t('portalSupport.filters.all')}</MenuItem>
              {SUPPORT_TICKET_AREAS.map((a) => (
                <MenuItem key={a} value={a}>{t(`portalSupport.areas.${a}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {t('portalSupport.admin.totalCount', { count: total })}
          </Typography>
        </Stack>
      </Paper>

      {state === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {state === 'error' && (
        <Alert severity="error">
          {t(`portalSupport.errors.${errorCode}`, { defaultValue: t('portalSupport.errors.load_failed') })}
        </Alert>
      )}
      {state === 'loaded' && tickets.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">{t('portalSupport.admin.noResults')}</Typography>
        </Paper>
      )}
      {state === 'loaded' && tickets.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding>
            {tickets.map((ticket) => (
              <ListItemButton key={ticket.id} onClick={() => openDetail(ticket.id)} divider>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2" sx={{ flex: 1 }}>{ticket.title}</Typography>
                      <Chip size="small" label={t(`portalSupport.statuses.${ticket.status}`)} color={statusColor(ticket.status)} />
                      <Chip size="small" variant="outlined" label={t(`portalSupport.categories.${ticket.category}`)} />
                      {ticket.priority && (
                        <Chip size="small" variant="outlined" label={t(`portalSupport.priorities.${ticket.priority}`)} />
                      )}
                      {ticket.area && (
                        <Chip size="small" variant="outlined" label={t(`portalSupport.areas.${ticket.area}`)} />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {t('portalSupport.list.updated', { when: formatDateTime(ticket.last_activity_at) })}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      <Dialog
        open={Boolean(selectedId)}
        onClose={closeDetail}
        fullWidth
        maxWidth="lg"
        fullScreen={isSmall}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          {t('portalSupport.admin.detailTitle')}
          <IconButton onClick={closeDetail} aria-label={t('portalSupport.detail.close')} size="small">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedId && (
            <SupportTicketAdminDetail
              ticketId={selectedId}
              onClose={closeDetail}
              onUpdated={load}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
