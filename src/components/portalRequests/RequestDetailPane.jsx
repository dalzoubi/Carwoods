import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  LinearProgress,
  Tab,
  Tabs,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import EditNote from '@mui/icons-material/EditNote';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import { RequestStatus, Role } from '../../domain/constants.js';
import { normalizeRole } from '../../portalUtils';

const CANCELLABLE_STATUS_CODES = new Set([RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED]);

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatAuditValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function roleLabel(roleValue, t) {
  const role = normalizeRole(roleValue);
  if (role === Role.ADMIN) return t('portalHeader.roles.admin');
  if (role === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (role === Role.TENANT) return t('portalHeader.roles.tenant');
  return t('portalHeader.roles.unknown');
}

function displayNameWithFallback(data, fallbackText) {
  const candidates = [data?.displayName, data?.email, data?.userId];
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (value) return value;
  }
  return fallbackText;
}

function NameWithRole({ name, role, t }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
      <Chip
        label={roleLabel(role, t)}
        size="small"
        color="primary"
        variant="outlined"
        sx={{ height: 20, fontSize: '0.7rem' }}
      />
    </Stack>
  );
}

const RequestDetailPane = ({
  requestDetail,
  detailStatus,
  detailError,
  isManagement,
  isAdmin,
  managementForm,
  managementStatusOptions,
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
  attachmentUploadProgress,
  auditEvents,
  auditStatus,
  auditError,
  onCancelRequest,
  cancelStatus,
  cancelError,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('details');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [suggestionActionMessage, setSuggestionActionMessage] = useState(null);
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
    : messageStatus === 'success'
      ? { severity: 'success', text: t('portalRequests.messages.sent') }
    : null;
  const attachmentStatusMessage = attachmentStatus === 'error'
    ? { severity: 'error', text: attachmentError || t('portalRequests.errors.saveFailed') }
    : attachmentStatus === 'success'
      ? { severity: 'success', text: t('portalRequests.attachments.saved') }
      : null;
  const suggestionActionStatusMessage = suggestionActionMessage
    ? { severity: suggestionActionMessage.severity, text: suggestionActionMessage.text }
    : null;
  const parsedAudits = useMemo(
    () => (Array.isArray(auditEvents) ? auditEvents : []).map((event) => {
      const parseJsonSafe = (raw) => {
        if (typeof raw !== 'string' || !raw.trim()) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      };
      return {
        ...event,
        beforeParsed: parseJsonSafe(event.before_json),
        afterParsed: parseJsonSafe(event.after_json),
        beforeObject:
          parseJsonSafe(event.before_json)
          && !Array.isArray(parseJsonSafe(event.before_json))
          && typeof parseJsonSafe(event.before_json) === 'object'
            ? parseJsonSafe(event.before_json)
            : null,
        afterObject:
          parseJsonSafe(event.after_json)
          && !Array.isArray(parseJsonSafe(event.after_json))
          && typeof parseJsonSafe(event.after_json) === 'object'
            ? parseJsonSafe(event.after_json)
            : null,
        changedFields: (() => {
          const beforeObj = parseJsonSafe(event.before_json);
          const afterObj = parseJsonSafe(event.after_json);
          if (
            !beforeObj
            || !afterObj
            || Array.isArray(beforeObj)
            || Array.isArray(afterObj)
            || typeof beforeObj !== 'object'
            || typeof afterObj !== 'object'
          ) {
            return [];
          }
          const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
          return [...keys].filter((key) => JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key]));
        })(),
      };
    }),
    [auditEvents]
  );

  useEffect(() => {
    if (!requestDetail) return;
    setActiveTab('details');
    setSuggestionActionMessage(null);
  }, [requestDetail]);
  useEffect(() => {
    if (attachmentStatus !== 'success') return;
    setAttachmentInputKey((value) => value + 1);
  }, [attachmentStatus]);

  const handleCopySuggestion = async () => {
    if (!suggestionText) return;
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(suggestionText);
      setSuggestionActionMessage({ severity: 'success', text: t('portalRequests.suggest.copySuccess') });
    } catch {
      setSuggestionActionMessage({ severity: 'error', text: t('portalRequests.suggest.copyFailed') });
    }
  };

  const handleInsertSuggestion = () => {
    if (!suggestionText) return;
    setMessageForm((prev) => ({ ...prev, body: suggestionText }));
    setSuggestionActionMessage({ severity: 'success', text: t('portalRequests.suggest.insertSuccess') });
  };

  return (
    <Stack spacing={2} sx={{ flex: 1 }}>
      <StatusAlertSlot
        message={
          cancelStatus === 'success'
            ? { severity: 'success', text: t('portalRequests.cancel.cancelled') }
            : cancelStatus === 'error'
              ? { severity: 'error', text: cancelError || t('portalRequests.errors.saveFailed') }
              : null
        }
      />
      {detailStatus === 'loading' && (
        <Alert severity="info">{t('portalRequests.loading')}</Alert>
      )}
      {detailStatus === 'error' && (
        <Alert severity="error">{detailError || t('portalRequests.errors.loadFailed')}</Alert>
      )}
      {!requestDetail && detailStatus !== 'loading' && (
        <Typography color="text.secondary">{t('portalRequests.list.selectPrompt')}</Typography>
      )}
      {requestDetail && (
        <>
      {isAdmin && (
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          aria-label={t('portalRequests.audit.tabsLabel')}
        >
          <Tab value="details" label={t('portalRequests.audit.detailsTab')} />
          <Tab value="audit" label={t('portalRequests.audit.auditTab')} />
        </Tabs>
      )}

      {isAdmin && activeTab === 'audit' ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>
              {t('portalRequests.audit.heading')}
            </Typography>
            {auditStatus === 'loading' && (
              <Typography color="text.secondary">{t('portalRequests.audit.loading')}</Typography>
            )}
            {auditStatus === 'error' && (
              <Alert severity="error">{auditError || t('portalRequests.errors.loadFailed')}</Alert>
            )}
            {auditStatus !== 'loading' && parsedAudits.length === 0 && (
              <Typography color="text.secondary">{t('portalRequests.audit.empty')}</Typography>
            )}
            {parsedAudits.map((event) => (
              <Box key={event.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Stack spacing={0.75}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {event.action} - {event.entity_type}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('portalRequests.audit.actor')}: {event.actor_display_name || event.actor_user_id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('portalRequests.audit.when')}: {formatDateTime(event.created_at)}
                  </Typography>
                  {event.changedFields.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {t('portalRequests.audit.changedFields')}: {event.changedFields.join(', ')}
                      </Typography>
                      {event.changedFields.map((field) => (
                        <Box
                          key={field}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0.75, p: 0.75 }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {field}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {t('portalRequests.audit.before')}: {formatAuditValue(event.beforeObject?.[field])}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {t('portalRequests.audit.after')}: {formatAuditValue(event.afterObject?.[field])}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {t('portalRequests.audit.before')}
                    </Typography>
                    <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 0.75 }}>
                      {JSON.stringify(event.beforeParsed, null, 2)}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {t('portalRequests.audit.after')}
                    </Typography>
                    <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 0.75 }}>
                      {JSON.stringify(event.afterParsed, null, 2)}
                    </Box>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : (
        <>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
        <Stack spacing={1}>
          <Typography sx={{ fontWeight: 700 }}>{requestDetail.title}</Typography>
          <Typography color="text.secondary">{requestDetail.description}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.requestId')}: {requestDetail.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.status')}: {requestDetail.status_name || requestDetail.status_code || '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.createdAt')}: {formatDateTime(requestDetail.created_at)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.updatedAt')}: {formatDateTime(requestDetail.updated_at)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.category')}: {requestDetail.category_name || requestDetail.category_code || '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.priority')}: {requestDetail.priority_name || requestDetail.priority_code || '-'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalRequests.labels.reportedBy')}:
            </Typography>
            <NameWithRole
              name={displayNameWithFallback({
                displayName: requestDetail.submitted_by_display_name,
                userId: requestDetail.submitted_by_user_id,
              }, t('portalRequests.messages.senderUnknown'))}
              role={requestDetail.submitted_by_role}
              t={t}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.scheduledFrom')}: {formatDateTime(requestDetail.scheduled_from || requestDetail.scheduled_for)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.scheduledTo')}: {formatDateTime(requestDetail.scheduled_to)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.vendorName')}: {requestDetail.vendor_contact_name || '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.labels.vendorPhone')}: {requestDetail.vendor_contact_phone || '-'}
          </Typography>
        </Stack>
      </Box>

      {!isManagement && CANCELLABLE_STATUS_CODES.has((requestDetail.status_code || '').toUpperCase()) && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>
              {t('portalRequests.cancel.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalRequests.cancel.description')}
            </Typography>
            <Stack direction="row">
              <Button
                type="button"
                variant="outlined"
                color="error"
                disabled={cancelStatus === 'saving'}
                onClick={() => setCancelDialogOpen(true)}
              >
                {cancelStatus === 'saving'
                  ? t('portalRequests.actions.saving')
                  : t('portalRequests.actions.cancelRequest')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>{t('portalRequests.cancel.confirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('portalRequests.cancel.confirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setCancelDialogOpen(false)}>
            {t('portalRequests.cancel.confirmNo')}
          </Button>
          <Button
            type="button"
            color="error"
            variant="contained"
            onClick={() => {
              setCancelDialogOpen(false);
              onCancelRequest();
            }}
          >
            {t('portalRequests.cancel.confirmYes')}
          </Button>
        </DialogActions>
      </Dialog>

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
            <FormControl>
              <InputLabel id="management-status-code-label">{t('portalRequests.management.statusCode')}</InputLabel>
              <Select
                labelId="management-status-code-label"
                label={t('portalRequests.management.statusCode')}
                value={managementForm.status_code}
                onChange={onManagementField('status_code')}
                disabled={managementUpdateStatus === 'saving'}
              >
                <MenuItem value="">
                  {t('portalRequests.management.selectStatusCode')}
                </MenuItem>
                {(managementStatusOptions || []).map((statusCode) => (
                  <MenuItem key={statusCode} value={statusCode}>
                    {t(`portalRequests.statuses.${String(statusCode || '').toUpperCase()}`, { defaultValue: statusCode })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('portalRequests.management.scheduledFrom')}
              type="datetime-local"
              value={managementForm.scheduled_from}
              onChange={onManagementField('scheduled_from')}
              disabled={managementUpdateStatus === 'saving'}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('portalRequests.management.scheduledTo')}
              type="datetime-local"
              value={managementForm.scheduled_to}
              onChange={onManagementField('scheduled_to')}
              disabled={managementUpdateStatus === 'saving'}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('portalRequests.management.vendorId')}
              value={managementForm.assigned_vendor_id}
              onChange={onManagementField('assigned_vendor_id')}
              disabled={managementUpdateStatus === 'saving'}
            />
            <TextField
              label={t('portalRequests.management.vendorContactName')}
              value={managementForm.vendor_contact_name}
              onChange={onManagementField('vendor_contact_name')}
              disabled={managementUpdateStatus === 'saving'}
            />
            <TextField
              label={t('portalRequests.management.vendorContactPhone')}
              value={managementForm.vendor_contact_phone}
              onChange={onManagementField('vendor_contact_phone')}
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
              <Button
                type="button"
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={handleCopySuggestion}
                disabled={!suggestionText}
              >
                {t('portalRequests.actions.copy')}
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<EditNote />}
                onClick={handleInsertSuggestion}
                disabled={!suggestionText}
              >
                {t('portalRequests.actions.insertIntoMessage')}
              </Button>
            </Stack>
            <StatusAlertSlot message={suggestionStatusMessage} />
            <StatusAlertSlot message={suggestionActionStatusMessage} />
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
                  <NameWithRole
                    name={displayNameWithFallback({
                      displayName: msg.sender_display_name,
                      email: msg.sender_email,
                      userId: msg.sender_user_id,
                    }, t('portalRequests.messages.senderUnknown'))}
                    role={msg.sender_role}
                    t={t}
                  />
                  {msg.is_internal && (
                    <Typography variant="caption" color="text.secondary">
                      {t('portalRequests.messages.internalTag')}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(msg.created_at)}
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
                <Box key={att.id}>
                  {att.file_url ? (
                    <Button
                      component="a"
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ textTransform: 'none', p: 0, minWidth: 0 }}
                    >
                      {att.original_filename}
                    </Button>
                  ) : (
                    <Box>
                      <Typography variant="body2">{att.original_filename}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('portalRequests.attachments.unavailable')}
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {att.media_type}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          <Button variant="outlined" component="label" type="button">
            {t('portalRequests.actions.chooseFile')}
            <input key={attachmentInputKey} type="file" hidden onChange={onAttachmentChange} />
          </Button>
          {attachmentFile && (
            <Typography color="text.secondary">
              {attachmentFile.name} ({attachmentFile.size} bytes)
            </Typography>
          )}
          <StatusAlertSlot message={attachmentStatusMessage} />
          {attachmentStatus === 'saving' && (
            <Stack spacing={0.5}>
              <LinearProgress
                variant={attachmentUploadProgress > 0 ? 'determinate' : 'indeterminate'}
                value={attachmentUploadProgress > 0 ? attachmentUploadProgress : undefined}
              />
              {attachmentUploadProgress > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('portalRequests.attachments.uploadProgress', { percent: attachmentUploadProgress })}
                </Typography>
              )}
            </Stack>
          )}
          <Stack direction="row" justifyContent="flex-end">
            <Button type="submit" variant="contained" disabled={!attachmentFile || attachmentStatus === 'saving'}>
              {attachmentStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : t('portalRequests.actions.attachFile')}
            </Button>
          </Stack>
        </Stack>
      </Box>
        </>
      )}
      </>
      )}
    </Stack>
  );
};

export default RequestDetailPane;

