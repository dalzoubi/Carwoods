import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AttachFile from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../../PortalAuthContext';
import {
  fetchAdminSupportTicketDetail,
  fetchSupportTicketAttachmentDownloadUrl,
  patchAdminSupportTicket,
  postAdminSupportTicketMessage,
} from '../../lib/portalApiClient';
import {
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_AREAS,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_MESSAGE_MAX,
  formatSupportTicketFileSize,
} from '../../supportTicketConstants';

function formatDateTime(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString(); } catch { return String(s); }
}

export default function SupportTicketAdminDetail({ ticketId, onUpdated, onClose }) {
  const { t } = useTranslation();
  const { baseUrl, getAccessToken, meData, account } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const [state, setState] = useState('loading');
  const [errorCode, setErrorCode] = useState('');
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [reply, setReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const accessToken = await getAccessToken();
      const data = await fetchAdminSupportTicketDetail(baseUrl, accessToken, ticketId, { emailHint });
      setTicket(data.ticket);
      setMessages(data.messages ?? []);
      setAttachments(data.attachments ?? []);
      setState('loaded');
    } catch (err) {
      setErrorCode(err?.code || 'load_failed');
      setState('error');
    }
  }, [baseUrl, emailHint, getAccessToken, ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPatch = async (patch) => {
    setSending(true);
    setErrorCode('');
    try {
      const accessToken = await getAccessToken();
      const resp = await patchAdminSupportTicket(baseUrl, accessToken, ticketId, {
        emailHint,
        ...patch,
      });
      setTicket(resp.ticket ?? ticket);
      onUpdated?.();
    } catch (err) {
      setErrorCode(err?.code || 'update_failed');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    setErrorCode('');
    try {
      const accessToken = await getAccessToken();
      await postAdminSupportTicketMessage(baseUrl, accessToken, ticketId, {
        emailHint,
        body_markdown: reply.trim(),
        is_internal_note: isInternalNote,
      });
      setReply('');
      setIsInternalNote(false);
      await load();
    } catch (err) {
      setErrorCode(err?.code || 'reply_failed');
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async (attachmentId) => {
    try {
      const accessToken = await getAccessToken();
      const resp = await fetchSupportTicketAttachmentDownloadUrl(
        baseUrl,
        accessToken,
        ticketId,
        attachmentId,
        { emailHint }
      );
      if (resp.url) window.open(resp.url, '_blank', 'noopener');
    } catch (err) {
      setErrorCode(err?.code || 'download_failed');
    }
  };

  if (state === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (state === 'error' || !ticket) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {t(`portalSupport.errors.${errorCode}`, { defaultValue: t('portalSupport.errors.load_failed') })}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {errorCode && (
        <Alert severity="error" onClose={() => setErrorCode('')}>
          {t(`portalSupport.errors.${errorCode}`, { defaultValue: t('portalSupport.errors.generic') })}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{ticket.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('portalSupport.admin.submittedBy', { id: ticket.user_id })} · {formatDateTime(ticket.created_at)}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
            {ticket.description_markdown}
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="admin-status-label">{t('portalSupport.admin.status')}</InputLabel>
            <Select
              labelId="admin-status-label"
              label={t('portalSupport.admin.status')}
              value={ticket.status}
              disabled={sending}
              onChange={(e) => applyPatch({ status: e.target.value })}
            >
              {SUPPORT_TICKET_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{t(`portalSupport.statuses.${s}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="admin-priority-label">{t('portalSupport.admin.priority')}</InputLabel>
            <Select
              labelId="admin-priority-label"
              label={t('portalSupport.admin.priority')}
              value={ticket.priority ?? ''}
              disabled={sending}
              onChange={(e) => applyPatch({ priority: e.target.value || null })}
            >
              <MenuItem value=""><em>{t('portalSupport.admin.none')}</em></MenuItem>
              {SUPPORT_TICKET_PRIORITIES.map((p) => (
                <MenuItem key={p} value={p}>{t(`portalSupport.priorities.${p}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="admin-category-label">{t('portalSupport.admin.category')}</InputLabel>
            <Select
              labelId="admin-category-label"
              label={t('portalSupport.admin.category')}
              value={ticket.category}
              disabled={sending}
              onChange={(e) => applyPatch({ category: e.target.value })}
            >
              {SUPPORT_TICKET_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{t(`portalSupport.categories.${c}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="admin-area-label">{t('portalSupport.admin.area')}</InputLabel>
            <Select
              labelId="admin-area-label"
              label={t('portalSupport.admin.area')}
              value={ticket.area ?? ''}
              disabled={sending}
              onChange={(e) => applyPatch({ area: e.target.value || null })}
            >
              <MenuItem value=""><em>{t('portalSupport.admin.none')}</em></MenuItem>
              {SUPPORT_TICKET_AREAS.map((a) => (
                <MenuItem key={a} value={a}>{t(`portalSupport.areas.${a}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {attachments.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>{t('portalSupport.detail.attachments')}</Typography>
          <List dense>
            {attachments.map((a) => (
              <ListItem key={a.id} disableGutters>
                <AttachFile fontSize="small" sx={{ mr: 1 }} />
                <ListItemText
                  primary={
                    <Link component="button" onClick={() => handleDownload(a.id)}>
                      {a.original_filename}
                    </Link>
                  }
                  secondary={formatSupportTicketFileSize(a.file_size_bytes)}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Box>
        <Typography variant="subtitle2" gutterBottom>{t('portalSupport.detail.messages')}</Typography>
        <Stack spacing={1}>
          {messages.length === 0 && (
            <Typography variant="caption" color="text.secondary">{t('portalSupport.detail.noMessages')}</Typography>
          )}
          {messages.map((m) => (
            <Paper
              key={m.id}
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: m.is_internal_note
                  ? 'warning.light'
                  : m.author_role === 'ADMIN' ? 'action.hover' : 'background.paper',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="baseline">
                <Typography variant="caption" color="text.secondary">
                  {m.author_role === 'ADMIN' ? t('portalSupport.detail.supportTeam') : t('portalSupport.admin.submitter')}
                </Typography>
                {m.is_internal_note && (
                  <Chip size="small" color="warning" label={t('portalSupport.admin.internalNote')} />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {formatDateTime(m.created_at)}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                {m.body_markdown}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Divider />

      <Box>
        <TextField
          label={t('portalSupport.admin.replyLabel')}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          helperText={`${reply.length}/${SUPPORT_TICKET_MESSAGE_MAX}`}
          disabled={sending}
        />
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                disabled={sending}
              />
            }
            label={t('portalSupport.admin.postAsInternalNote')}
          />
          <Stack direction="row" spacing={1}>
            {onClose && (
              <Button onClick={onClose} disabled={sending}>
                {t('portalSupport.detail.close')}
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!reply.trim() || sending}
            >
              {t('portalSupport.detail.send')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
