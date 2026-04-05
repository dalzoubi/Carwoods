import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';

const RequestDetailPane = ({
  requestDetail,
  isManagement,
  managementForm,
  onManagementField,
  onUpdateRequest,
  managementUpdateStatus,
  managementUpdateError,
  onSuggestReply,
  suggestionStatus,
  suggestionError,
  suggestionText,
  threadMessages,
  messageForm,
  setMessageForm,
  onMessageSubmit,
  messageStatus,
  messageError,
  attachments,
  onAttachmentChange,
  onAttachmentSubmit,
  attachmentFile,
  attachmentStatus,
  attachmentError,
}) => {
  const { t } = useTranslation();
  const managementStatusMessage = managementUpdateStatus === 'error'
    ? { severity: 'error', text: managementUpdateError || t('portalRequests.errors.saveFailed') }
    : managementUpdateStatus === 'success'
      ? { severity: 'success', text: t('portalRequests.management.saved') }
      : null;
  const suggestionStatusMessage = suggestionStatus === 'error'
    ? { severity: 'error', text: suggestionError || t('portalRequests.errors.loadFailed') }
    : null;
  const messageStatusMessage = messageStatus === 'error'
    ? { severity: 'error', text: messageError || t('portalRequests.errors.saveFailed') }
    : null;
  const attachmentStatusMessage = attachmentStatus === 'error'
    ? { severity: 'error', text: attachmentError || t('portalRequests.errors.saveFailed') }
    : attachmentStatus === 'success'
      ? { severity: 'success', text: t('portalRequests.attachments.saved') }
      : null;

  if (!requestDetail) return null;

  return (
    <Stack spacing={2} sx={{ flex: 1 }}>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
        <Stack spacing={1}>
          <Typography sx={{ fontWeight: 700 }}>{requestDetail.title}</Typography>
          <Typography color="text.secondary">{requestDetail.description}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.requestId')}: {requestDetail.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.status')}: {requestDetail.current_status_id || '-'}
          </Typography>
        </Stack>
      </Box>

      {isManagement && (
        <Box
          component="form"
          onSubmit={onUpdateRequest}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>
              {t('portalRequests.management.heading')}
            </Typography>
            <TextField
              label={t('portalRequests.management.statusCode')}
              value={managementForm.status_code}
              onChange={onManagementField('status_code')}
              placeholder={t('portalRequests.management.statusCodePlaceholder')}
              disabled={managementUpdateStatus === 'saving'}
            />
            <TextField
              label={t('portalRequests.management.vendorId')}
              value={managementForm.assigned_vendor_id}
              onChange={onManagementField('assigned_vendor_id')}
              disabled={managementUpdateStatus === 'saving'}
            />
            <TextField
              label={t('portalRequests.management.internalNotes')}
              value={managementForm.internal_notes}
              onChange={onManagementField('internal_notes')}
              multiline
              minRows={3}
              disabled={managementUpdateStatus === 'saving'}
            />
            <StatusAlertSlot message={managementStatusMessage} />
            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained" disabled={managementUpdateStatus === 'saving'}>
                {managementUpdateStatus === 'saving'
                  ? t('portalRequests.actions.saving')
                  : t('portalRequests.actions.saveChanges')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {isManagement && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>
              {t('portalRequests.suggest.heading')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button type="button" variant="outlined" onClick={onSuggestReply} disabled={suggestionStatus === 'loading'}>
                {t('portalRequests.actions.suggestReply')}
              </Button>
            </Stack>
            <StatusAlertSlot message={suggestionStatusMessage} />
            {suggestionStatus === 'ok' && suggestionText && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Typography>{suggestionText}</Typography>
              </Box>
            )}
          </Stack>
        </Box>
      )}

      <Box
        component="form"
        onSubmit={onMessageSubmit}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>
            {t('portalRequests.messages.heading')}
          </Typography>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Stack spacing={1}>
              {threadMessages.length === 0 && (
                <Typography color="text.secondary">{t('portalRequests.messages.empty')}</Typography>
              )}
              {threadMessages.map((msg) => (
                <Box key={msg.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {msg.sender_user_id} {msg.is_internal ? `(${t('portalRequests.messages.internalTag')})` : ''}
                  </Typography>
                  <Typography color="text.secondary">{msg.body}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          <TextField
            label={t('portalRequests.messages.bodyLabel')}
            value={messageForm.body}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, body: event.target.value }))}
            multiline
            minRows={2}
            required
            disabled={messageStatus === 'saving'}
          />
          {isManagement && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(messageForm.is_internal)}
                  onChange={(event) =>
                    setMessageForm((prev) => ({
                      ...prev,
                      is_internal: event.target.checked,
                    }))
                  }
                />
              }
              label={t('portalRequests.messages.internalToggle')}
            />
          )}
          <StatusAlertSlot message={messageStatusMessage} />
          <Stack direction="row" justifyContent="flex-end">
            <Button type="submit" variant="contained" disabled={messageStatus === 'saving'}>
              {messageStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : t('portalRequests.actions.sendMessage')}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box
        component="form"
        onSubmit={onAttachmentSubmit}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>
            {t('portalRequests.attachments.heading')}
          </Typography>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Stack spacing={0.75}>
              {attachments.length === 0 && (
                <Typography color="text.secondary">{t('portalRequests.attachments.empty')}</Typography>
              )}
              {attachments.map((att) => (
                <Typography key={att.id} variant="body2">
                  {att.original_filename} ({att.media_type})
                </Typography>
              ))}
            </Stack>
          </Box>
          <Button variant="outlined" component="label" type="button">
            {t('portalRequests.actions.chooseFile')}
            <input type="file" hidden onChange={onAttachmentChange} />
          </Button>
          {attachmentFile && (
            <Typography color="text.secondary">
              {attachmentFile.name} ({attachmentFile.size} bytes)
            </Typography>
          )}
          <StatusAlertSlot message={attachmentStatusMessage} />
          <Stack direction="row" justifyContent="flex-end">
            <Button type="submit" variant="contained" disabled={!attachmentFile || attachmentStatus === 'saving'}>
              {attachmentStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : t('portalRequests.actions.attachFile')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
};

export default RequestDetailPane;

