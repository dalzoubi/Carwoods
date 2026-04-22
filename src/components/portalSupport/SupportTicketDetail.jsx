import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AttachFile from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../../PortalAuthContext';
import {
  fetchSupportTicketAttachmentDownloadUrl,
  fetchSupportTicketDetail,
  postSupportTicketMessage,
  reopenSupportTicket,
} from '../../lib/portalApiClient';
import {
  SUPPORT_TICKET_MESSAGE_MAX,
  formatSupportTicketFileSize,
} from '../../supportTicketConstants';

function formatDateTime(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s);
  }
}

export default function SupportTicketDetail({ ticketId, onClose }) {
  const { t } = useTranslation();
  const { baseUrl, getAccessToken, meData, account } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';
  const [state, setState] = useState('loading');
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [errorCode, setErrorCode] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const accessToken = await getAccessToken();
      const data = await fetchSupportTicketDetail(baseUrl, accessToken, ticketId, { emailHint });
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

  const canReply = ticket && ticket.status !== 'CLOSED' && reply.trim().length > 0
    && reply.length <= SUPPORT_TICKET_MESSAGE_MAX;

  const handleSendReply = async () => {
    if (!canReply) return;
    setSending(true);
    setErrorCode('');
    try {
      const accessToken = await getAccessToken();
      await postSupportTicketMessage(baseUrl, accessToken, ticketId, {
        emailHint,
        body_markdown: reply.trim(),
      });
      setReply('');
      await load();
    } catch (err) {
      setErrorCode(err?.code || 'reply_failed');
    } finally {
      setSending(false);
    }
  };

  const handleReopen = async () => {
    setSending(true);
    setErrorCode('');
    try {
      const accessToken = await getAccessToken();
      await reopenSupportTicket(baseUrl, accessToken, ticketId, { emailHint });
      await load();
    } catch (err) {
      setErrorCode(err?.code || 'reopen_failed');
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

  const isClosed = ticket.status === 'CLOSED';
  const canReopen = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {errorCode && (
        <Alert severity="error" onClose={() => setErrorCode('')}>
          {t(`portalSupport.errors.${errorCode}`, { defaultValue: t('portalSupport.errors.generic') })}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" sx={{ flex: 1 }}>{ticket.title}</Typography>
            <Chip size="small" label={t(`portalSupport.statuses.${ticket.status}`)} color={
              ticket.status === 'OPEN' ? 'info'
                : ticket.status === 'IN_PROGRESS' ? 'warning'
                  : ticket.status === 'RESOLVED' ? 'success'
                    : 'default'
            } />
            <Chip size="small" variant="outlined" label={t(`portalSupport.categories.${ticket.category}`)} />
            {ticket.area && (
              <Chip size="small" variant="outlined" label={t(`portalSupport.areas.${ticket.area}`)} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('portalSupport.detail.createdAt', { when: formatDateTime(ticket.created_at) })}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
            {ticket.description_markdown}
          </Typography>
        </Stack>
      </Paper>

      {attachments.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('portalSupport.detail.attachments')}
          </Typography>
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
        <Typography variant="subtitle2" gutterBottom>
          {t('portalSupport.detail.messages')}
        </Typography>
        <Stack spacing={1}>
          {messages.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              {t('portalSupport.detail.noMessages')}
            </Typography>
          )}
          {messages.map((m) => (
            <Paper
              key={m.id}
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: m.author_role === 'ADMIN' ? 'action.hover' : 'background.paper',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="baseline">
                <Typography variant="caption" color="text.secondary">
                  {m.author_role === 'ADMIN' ? t('portalSupport.detail.supportTeam') : t('portalSupport.detail.you')}
                </Typography>
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

      {!isClosed && (
        <Box>
          <TextField
            label={t('portalSupport.detail.replyLabel')}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            helperText={`${reply.length}/${SUPPORT_TICKET_MESSAGE_MAX}`}
            disabled={sending}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
            {onClose && (
              <Button onClick={onClose} disabled={sending}>
                {t('portalSupport.detail.close')}
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleSendReply}
              disabled={!canReply || sending}
            >
              {t('portalSupport.detail.send')}
            </Button>
          </Stack>
        </Box>
      )}

      {canReopen && (
        <Button
          onClick={handleReopen}
          disabled={sending}
          variant="outlined"
          color="secondary"
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('portalSupport.detail.reopen')}
        </Button>
      )}
    </Box>
  );
}
