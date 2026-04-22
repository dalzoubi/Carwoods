import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AttachFile from '@mui/icons-material/AttachFile';
import Close from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../../PortalAuthContext';
import {
  submitSupportTicket,
  supportTicketAttachmentUploadIntent,
  finalizeSupportTicketAttachment,
  putBlobToStorage,
} from '../../lib/portalApiClient';
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_AREAS,
  SUPPORT_TICKET_TITLE_MAX,
  SUPPORT_TICKET_BODY_MAX,
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  SUPPORT_TICKET_MAX_ATTACHMENT_BYTES,
  SUPPORT_TICKET_ALLOWED_MIME,
  formatSupportTicketFileSize,
  isAllowedSupportTicketMime,
} from '../../supportTicketConstants';
import { collectClientDiagnostics } from '../../hooks/collectClientDiagnostics';

function validateFile(file) {
  if (!file) return 'invalid_file';
  if (!isAllowedSupportTicketMime(file.type)) return 'content_type_not_allowed';
  if (file.size <= 0) return 'invalid_file_size';
  if (file.size > SUPPORT_TICKET_MAX_ATTACHMENT_BYTES) return 'file_too_large';
  return null;
}

/**
 * Lean submit form — title + description + category + area + attachments.
 * Diagnostics are collected silently and sent alongside the ticket so bug
 * reports include URL/browser context without the user having to type it.
 */
export default function SupportTicketSubmitForm({ onSubmitted, onCancel, initialValues }) {
  const { t } = useTranslation();
  const { baseUrl, getAccessToken, meData, account } = usePortalAuth();
  const emailHint = meData?.user?.email ?? account?.username ?? '';

  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [category, setCategory] = useState(initialValues?.category ?? 'BUG');
  const [area, setArea] = useState(initialValues?.area ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [files, setFiles] = useState([]); // { file, status, error, attachmentId }
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | error
  const [errorCode, setErrorCode] = useState('');
  const fileInputRef = useRef(null);

  const remainingSlots = SUPPORT_TICKET_MAX_ATTACHMENTS - files.length;
  const disabled = submitState === 'submitting';

  const titleError = useMemo(() => {
    if (title.length > SUPPORT_TICKET_TITLE_MAX) return 'title_too_long';
    return '';
  }, [title]);
  const descError = useMemo(() => {
    if (description.length > SUPPORT_TICKET_BODY_MAX) return 'description_too_long';
    return '';
  }, [description]);

  const canSubmit = (
    !disabled
    && title.trim().length > 0
    && title.length <= SUPPORT_TICKET_TITLE_MAX
    && description.trim().length > 0
    && description.length <= SUPPORT_TICKET_BODY_MAX
    && SUPPORT_TICKET_CATEGORIES.includes(category)
  );

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleFilesSelected = (event) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    const next = [...files];
    for (const file of picked) {
      if (next.length >= SUPPORT_TICKET_MAX_ATTACHMENTS) break;
      const vError = validateFile(file);
      next.push({ file, status: vError ? 'error' : 'pending', error: vError ?? null });
    }
    setFiles(next);
  };

  const removeFileAt = (index) => {
    setFiles((curr) => curr.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (ticketId, accessToken) => {
    const results = [];
    for (let i = 0; i < files.length; i += 1) {
      const entry = files[i];
      if (entry.error) continue;
      setFiles((curr) => curr.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f)));
      try {
        const intent = await supportTicketAttachmentUploadIntent(
          baseUrl,
          accessToken,
          ticketId,
          {
            emailHint,
            filename: entry.file.name,
            content_type: entry.file.type || 'application/octet-stream',
            size_bytes: entry.file.size,
          }
        );
        await putBlobToStorage(intent.upload_url, entry.file);
        await finalizeSupportTicketAttachment(
          baseUrl,
          accessToken,
          ticketId,
          intent.attachment.id,
          { emailHint }
        );
        setFiles((curr) =>
          curr.map((f, idx) =>
            (idx === i ? { ...f, status: 'done', attachmentId: intent.attachment.id } : f)
          )
        );
        results.push({ ok: true });
      } catch (err) {
        setFiles((curr) =>
          curr.map((f, idx) =>
            (idx === i ? { ...f, status: 'error', error: err?.code ?? 'upload_failed' } : f)
          )
        );
        results.push({ ok: false, err });
      }
    }
    return results;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitState('submitting');
    setErrorCode('');
    try {
      const accessToken = await getAccessToken();
      const diagnostics = collectClientDiagnostics();
      const resp = await submitSupportTicket(baseUrl, accessToken, {
        emailHint,
        title: title.trim(),
        description_markdown: description.trim(),
        category,
        area: area || null,
        diagnostics,
      });
      const ticketId = resp.ticket?.id;
      if (ticketId && files.length > 0) {
        await uploadAttachments(ticketId, accessToken);
      }
      setSubmitState('idle');
      onSubmitted?.(resp.ticket);
    } catch (err) {
      setSubmitState('error');
      setErrorCode(err?.code || 'submit_failed');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {submitState === 'error' && (
        <Alert severity="error" onClose={() => setSubmitState('idle')}>
          {t(`portalSupport.submit.errors.${errorCode}`, { defaultValue: t('portalSupport.submit.errors.submit_failed') })}
        </Alert>
      )}

      <FormControl fullWidth disabled={disabled}>
        <InputLabel id="support-ticket-category-label">{t('portalSupport.fields.category')}</InputLabel>
        <Select
          labelId="support-ticket-category-label"
          label={t('portalSupport.fields.category')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {SUPPORT_TICKET_CATEGORIES.map((c) => (
            <MenuItem key={c} value={c}>{t(`portalSupport.categories.${c}`)}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth disabled={disabled}>
        <InputLabel id="support-ticket-area-label">{t('portalSupport.fields.area')}</InputLabel>
        <Select
          labelId="support-ticket-area-label"
          label={t('portalSupport.fields.area')}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <MenuItem value="">
            <em>{t('portalSupport.fields.areaNone')}</em>
          </MenuItem>
          {SUPPORT_TICKET_AREAS.map((a) => (
            <MenuItem key={a} value={a}>{t(`portalSupport.areas.${a}`)}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label={t('portalSupport.fields.title')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled}
        error={Boolean(titleError)}
        helperText={
          titleError
            ? t(`portalSupport.submit.errors.${titleError}`)
            : `${title.length}/${SUPPORT_TICKET_TITLE_MAX}`
        }
        required
        fullWidth
      />

      <TextField
        label={t('portalSupport.fields.description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={disabled}
        error={Boolean(descError)}
        helperText={
          descError
            ? t(`portalSupport.submit.errors.${descError}`)
            : `${description.length}/${SUPPORT_TICKET_BODY_MAX}`
        }
        required
        multiline
        minRows={6}
        fullWidth
      />

      <Box>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORT_TICKET_ALLOWED_MIME.join(',')}
          style={{ display: 'none' }}
          onChange={handleFilesSelected}
          data-testid="support-ticket-attachment-input"
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button
            onClick={handleFileButtonClick}
            startIcon={<AttachFile />}
            disabled={disabled || remainingSlots <= 0}
            size="small"
            variant="outlined"
          >
            {t('portalSupport.fields.attach')}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {t('portalSupport.fields.attachmentLimits', {
              count: SUPPORT_TICKET_MAX_ATTACHMENTS,
              mb: Math.round(SUPPORT_TICKET_MAX_ATTACHMENT_BYTES / (1024 * 1024)),
            })}
          </Typography>
        </Stack>
        {files.length > 0 && (
          <List dense>
            {files.map((entry, idx) => (
              <ListItem
                key={`${entry.file.name}-${idx}`}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => removeFileAt(idx)}
                    disabled={disabled}
                    aria-label={t('portalSupport.fields.removeAttachment')}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={entry.file.name}
                  secondary={
                    entry.error
                      ? t(`portalSupport.submit.errors.${entry.error}`, { defaultValue: entry.error })
                      : `${formatSupportTicketFileSize(entry.file.size)} — ${t(`portalSupport.attachmentStatus.${entry.status}`)}`
                  }
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: entry.error ? 'error.main' : 'text.secondary',
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <FormHelperText>{t('portalSupport.submit.diagnosticsNotice')}</FormHelperText>

      {submitState === 'submitting' && <LinearProgress />}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {onCancel && (
          <Button onClick={onCancel} disabled={disabled}>
            {t('portalSupport.submit.cancel')}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {t('portalSupport.submit.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
