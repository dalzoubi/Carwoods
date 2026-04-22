import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Send from '@mui/icons-material/Send';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import {
  fetchAdminContactRequestThread,
  postAdminContactRequestReply,
  postAdminContactRequestSuggestReply,
  fetchAdminContactReplyTemplates,
} from '../lib/portalApiClient';

const TONE_OPTIONS = ['friendly', 'formal', 'apologetic', 'concise'];
const LENGTH_OPTIONS = ['short', 'medium', 'detailed'];

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AdminMessageBubble({ message, t }) {
  const authorLabel =
    (message.author_name && message.author_name.trim()) ||
    message.author_email ||
    t('portalAdminContactRequests.reply.adminAuthorFallback');
  const isInternal = message.is_internal_note;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderLeft: (theme) =>
          `4px solid ${isInternal ? theme.palette.warning.main : theme.palette.primary.main}`,
        bgcolor: isInternal ? 'warning.50' : 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 0.5 }}>
        <Typography variant="body2" fontWeight={600}>
          {authorLabel}
        </Typography>
        {isInternal && (
          <Chip size="small" color="warning" label={t('portalAdminContactRequests.reply.internalTag')} />
        )}
        {message.ai_suggested && (
          <Chip
            size="small"
            color="secondary"
            icon={<AutoAwesome sx={{ fontSize: 14 }} />}
            label={t('portalAdminContactRequests.reply.aiAssistedTag')}
          />
        )}
        {!isInternal && message.email_sent_at && (
          <Chip size="small" color="success" variant="outlined" label={t('portalAdminContactRequests.reply.emailedTag')} />
        )}
        {!isInternal && !message.email_sent_at && message.email_error && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            label={t('portalAdminContactRequests.reply.emailFailedTag')}
          />
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {formatDate(message.created_at)}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {message.body}
      </Typography>
      {!isInternal && message.email_error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {t('portalAdminContactRequests.reply.emailErrorPrefix')} {message.email_error}
        </Typography>
      )}
    </Paper>
  );
}

export default function PortalAdminContactReplyThread({
  baseUrl,
  accessToken,
  emailHint,
  contactRequest,
  onReplySent,
  onError,
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadError, setThreadError] = useState('');
  const [body, setBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [tone, setTone] = useState('friendly');
  const [length, setLength] = useState('medium');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [lastSuggestion, setLastSuggestion] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const requestId = contactRequest?.id;
  const subject = contactRequest?.subject;

  const loadThread = useCallback(async () => {
    if (!baseUrl || !requestId) return;
    setLoading(true);
    setThreadError('');
    try {
      const token = await accessToken();
      const data = await fetchAdminContactRequestThread(baseUrl, token, {
        requestId,
        emailHint,
      });
      setMessages(data.messages ?? []);
    } catch (err) {
      setThreadError(t('portalAdminContactRequests.reply.loadThreadError'));
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, requestId, accessToken, emailHint, t, onError]);

  const loadTemplates = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const token = await accessToken();
      const data = await fetchAdminContactReplyTemplates(baseUrl, token, {
        subjectScope: subject,
        emailHint,
      });
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    }
  }, [baseUrl, subject, accessToken, emailHint]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleApplyTemplate = (id) => {
    setSelectedTemplateId(id);
    if (!id) return;
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${tpl.body}` : tpl.body));
  };

  const handleSuggest = async () => {
    if (!baseUrl || !requestId) return;
    setSuggesting(true);
    setSuggestError('');
    try {
      const token = await accessToken();
      const data = await postAdminContactRequestSuggestReply(baseUrl, token, {
        requestId,
        tone,
        length,
        emailHint,
      });
      setLastSuggestion({ text: data.suggestion, model: data.model });
    } catch (err) {
      const code = err?.code || 'suggest_failed';
      if (code === 'ai_not_configured') {
        setSuggestError(t('portalAdminContactRequests.reply.suggestNotConfigured'));
      } else if (code === 'ai_unavailable') {
        setSuggestError(t('portalAdminContactRequests.reply.suggestUnavailable'));
      } else {
        setSuggestError(t('portalAdminContactRequests.reply.suggestFailed'));
      }
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = () => {
    if (!lastSuggestion?.text) return;
    setBody(lastSuggestion.text);
  };

  const handleSend = async () => {
    if (!baseUrl || !requestId) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setSendError(t('portalAdminContactRequests.reply.emptyBodyError'));
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const token = await accessToken();
      const data = await postAdminContactRequestReply(baseUrl, token, {
        requestId,
        body: trimmed,
        isInternalNote,
        aiSuggested: Boolean(lastSuggestion?.text && trimmed === lastSuggestion.text),
        aiModel: lastSuggestion?.model ?? null,
        markHandled: !isInternalNote,
        emailHint,
      });
      setBody('');
      setLastSuggestion(null);
      setSelectedTemplateId('');
      await loadThread();
      if (onReplySent) {
        onReplySent({
          contactRequest: data.contact_request,
          emailDelivered: data.email_delivered,
          emailError: data.email_error,
          isInternalNote,
        });
      }
    } catch (err) {
      const code = err?.code || 'send_failed';
      if (code === 'body_too_long') {
        setSendError(t('portalAdminContactRequests.reply.bodyTooLongError'));
      } else {
        setSendError(t('portalAdminContactRequests.reply.sendFailed'));
      }
      if (onError) onError(err);
    } finally {
      setSending(false);
    }
  };

  const toneLabel = useMemo(
    () => TONE_OPTIONS.map((x) => ({ v: x, label: t(`portalAdminContactRequests.reply.tone.${x}`) })),
    [t]
  );
  const lengthLabel = useMemo(
    () => LENGTH_OPTIONS.map((x) => ({ v: x, label: t(`portalAdminContactRequests.reply.length.${x}`) })),
    [t]
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('portalAdminContactRequests.reply.threadHeading')}
        </Typography>
        <IconButton
          size="small"
          onClick={() => { void loadThread(); }}
          disabled={loading}
          aria-label={t('portalAdminContactRequests.reply.refreshThread')}
        >
          <Refresh fontSize="small" />
        </IconButton>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : threadError ? (
        <Alert severity="error" sx={{ mb: 1 }}>{threadError}</Alert>
      ) : messages.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('portalAdminContactRequests.reply.noRepliesYet')}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {messages.map((m) => (
            <AdminMessageBubble key={m.id} message={m} t={t} />
          ))}
        </Stack>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('portalAdminContactRequests.reply.composeHeading')}
        </Typography>

        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 160, flex: '1 1 180px' }}>
            <InputLabel id="reply-template-label">
              {t('portalAdminContactRequests.reply.templateLabel')}
            </InputLabel>
            <Select
              labelId="reply-template-label"
              value={selectedTemplateId}
              label={t('portalAdminContactRequests.reply.templateLabel')}
              onChange={(e) => handleApplyTemplate(e.target.value)}
              disabled={sending || templates.length === 0}
            >
              <MenuItem value="">
                <em>{t('portalAdminContactRequests.reply.templateNone')}</em>
              </MenuItem>
              {templates.map((tpl) => (
                <MenuItem key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="reply-tone-label">
              {t('portalAdminContactRequests.reply.toneLabel')}
            </InputLabel>
            <Select
              labelId="reply-tone-label"
              value={tone}
              label={t('portalAdminContactRequests.reply.toneLabel')}
              onChange={(e) => setTone(e.target.value)}
              disabled={suggesting}
            >
              {toneLabel.map((o) => (
                <MenuItem key={o.v} value={o.v}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="reply-length-label">
              {t('portalAdminContactRequests.reply.lengthLabel')}
            </InputLabel>
            <Select
              labelId="reply-length-label"
              value={length}
              label={t('portalAdminContactRequests.reply.lengthLabel')}
              onChange={(e) => setLength(e.target.value)}
              disabled={suggesting}
            >
              {lengthLabel.map((o) => (
                <MenuItem key={o.v} value={o.v}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => { void handleSuggest(); }}
            disabled={suggesting || sending}
            startIcon={suggesting ? <CircularProgress size={14} /> : <AutoAwesome />}
          >
            {t('portalAdminContactRequests.reply.suggestButton')}
          </Button>
        </Stack>

        {suggestError && (
          <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setSuggestError('')}>
            {suggestError}
          </Alert>
        )}

        {lastSuggestion && (
          <Alert
            severity="info"
            sx={{ mb: 1 }}
            action={
              <Stack direction="row" gap={0.5}>
                <Button size="small" onClick={applySuggestion}>
                  {t('portalAdminContactRequests.reply.useSuggestion')}
                </Button>
                <Button size="small" color="inherit" onClick={() => setLastSuggestion(null)}>
                  {t('portalAdminContactRequests.reply.dismissSuggestion')}
                </Button>
              </Stack>
            }
          >
            <Typography variant="caption" display="block" sx={{ opacity: 0.8, mb: 0.5 }}>
              {t('portalAdminContactRequests.reply.suggestionFrom', { model: lastSuggestion.model })}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {lastSuggestion.text}
            </Typography>
          </Alert>
        )}

        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={14}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('portalAdminContactRequests.reply.placeholder')}
          disabled={sending}
          sx={{ mb: 1 }}
        />

        {sendError && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSendError('')}>
            {sendError}
          </Alert>
        )}

        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <FormControlLabel
            control={
              <Switch
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                disabled={sending}
                size="small"
              />
            }
            label={t('portalAdminContactRequests.reply.internalNoteToggle')}
          />
          <Box sx={{ flex: 1 }} />
          <Button
            type="button"
            variant="contained"
            size="small"
            onClick={() => { void handleSend(); }}
            disabled={sending || !body.trim()}
            startIcon={sending ? <CircularProgress size={14} /> : <Send />}
          >
            {isInternalNote
              ? t('portalAdminContactRequests.reply.saveInternalNote')
              : t('portalAdminContactRequests.reply.sendReply')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
