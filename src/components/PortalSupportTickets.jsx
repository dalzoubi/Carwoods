import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { fetchSupportTickets } from '../lib/portalApiClient';
import SupportTicketSubmitForm from './portalSupport/SupportTicketSubmitForm';
import SupportTicketDetail from './portalSupport/SupportTicketDetail';
import { SUPPORT_TICKET_STATUSES } from '../supportTicketConstants';

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

export default function PortalSupportTickets() {
  const { t } = useTranslation();
  const { baseUrl, getAccessToken, meData, account } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('tab') === 'submit' ? 'submit' : 'list');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [tickets, setTickets] = useState([]);
  const [state, setState] = useState('loading');
  const [errorCode, setErrorCode] = useState('');
  const selectedId = searchParams.get('id') || '';

  const load = useCallback(async () => {
    setState('loading');
    try {
      const accessToken = await getAccessToken();
      const data = await fetchSupportTickets(baseUrl, accessToken, {
        emailHint,
        status: statusFilter || undefined,
      });
      setTickets(data.tickets ?? []);
      setState('loaded');
    } catch (err) {
      setErrorCode(err?.code || 'load_failed');
      setState('error');
    }
  }, [baseUrl, emailHint, getAccessToken, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTabChange = (_e, val) => {
    setTab(val);
    const next = new URLSearchParams(searchParams);
    if (val === 'submit') next.set('tab', 'submit');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

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

  const handleSubmitted = (ticket) => {
    setTab('list');
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    if (ticket?.id) next.set('id', ticket.id);
    setSearchParams(next, { replace: true });
    load();
  };

  const statusOptions = useMemo(() => ['', ...SUPPORT_TICKET_STATUSES], []);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">{t('portalSupport.pageTitle')}</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleTabChange(null, 'submit')}
        >
          {t('portalSupport.newTicket')}
        </Button>
      </Stack>

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab value="list" label={t('portalSupport.tabs.myTickets')} />
        <Tab value="submit" label={t('portalSupport.tabs.submit')} />
      </Tabs>

      {tab === 'submit' && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <SupportTicketSubmitForm
            onSubmitted={handleSubmitted}
            onCancel={() => handleTabChange(null, 'list')}
          />
        </Paper>
      )}

      {tab === 'list' && (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalSupport.filters.statusLabel')}
            </Typography>
            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              displayEmpty
            >
              {statusOptions.map((s) => (
                <MenuItem key={s || 'all'} value={s}>
                  {s ? t(`portalSupport.statuses.${s}`) : t('portalSupport.filters.all')}
                </MenuItem>
              ))}
            </Select>
          </Stack>

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
              <Typography variant="body2" color="text.secondary">
                {t('portalSupport.list.empty')}
              </Typography>
            </Paper>
          )}
          {state === 'loaded' && tickets.length > 0 && (
            <Paper variant="outlined">
              <List disablePadding>
                {tickets.map((ticket) => (
                  <ListItemButton
                    key={ticket.id}
                    onClick={() => openDetail(ticket.id)}
                    divider
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" sx={{ flex: 1 }}>{ticket.title}</Typography>
                          <Chip
                            size="small"
                            label={t(`portalSupport.statuses.${ticket.status}`)}
                            color={statusColor(ticket.status)}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t(`portalSupport.categories.${ticket.category}`)}
                          />
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
        </Box>
      )}

      <Dialog
        open={Boolean(selectedId)}
        onClose={closeDetail}
        fullWidth
        maxWidth="md"
        fullScreen={isSmall}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          {t('portalSupport.detail.title')}
          <IconButton onClick={closeDetail} aria-label={t('portalSupport.detail.close')} size="small">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedId && <SupportTicketDetail ticketId={selectedId} onClose={closeDetail} />}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
