import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Checkbox,
  CircularProgress,
  Collapse,
  Divider,
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
  Switch,
  LinearProgress,
  Tab,
  Tabs,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import InlineActionStatus from '../InlineActionStatus';
import { RequestStatus, Role } from '../../domain/constants.js';
import { normalizeRole } from '../../portalUtils';
import { getStatusChipSx } from './requestChipStyles';

const CANCELLABLE_STATUS_CODES = new Set([RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED]);
const ELSA_MODE_LABEL_KEYS = {
  NEED_MORE_INFO: 'portalRequests.elsa.modes.needMoreInfo',
  SAFE_BASIC_TROUBLESHOOTING: 'portalRequests.elsa.modes.basicTroubleshooting',
  ESCALATE_TO_VENDOR: 'portalRequests.elsa.modes.dispatchVendor',
  EMERGENCY_ESCALATION: 'portalRequests.elsa.modes.emergency',
  DUPLICATE_OR_ALREADY_IN_PROGRESS: 'portalRequests.elsa.modes.duplicateOrInProgress',
};

function toPriorityCode(priorityCode, priorityName) {
  const fromCode = String(priorityCode ?? '').trim().toUpperCase();
  if (fromCode) return fromCode;
  const fromName = String(priorityName ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  return fromName;
}

function priorityTone(requestDetail) {
  const code = toPriorityCode(requestDetail?.priority_code, requestDetail?.priority_name);
  if (code === 'EMERGENCY') {
    return { chipColor: 'error' };
  }
  if (code === 'URGENT') {
    return { chipColor: 'warning' };
  }
  if (code === 'ROUTINE') {
    return { chipColor: 'info' };
  }
  return { chipColor: 'default' };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatScheduleWindow(requestDetail, t) {
  const scheduledStart = requestDetail?.scheduled_from || requestDetail?.scheduled_for;
  const scheduledEnd = requestDetail?.scheduled_to;
  if (scheduledStart && scheduledEnd) {
    return `${formatDateTime(scheduledStart)} - ${formatDateTime(scheduledEnd)}`;
  }
  if (scheduledStart) {
    return t('portalRequests.labels.scheduleStartsAt', { date: formatDateTime(scheduledStart) });
  }
  if (scheduledEnd) {
    return t('portalRequests.labels.scheduleUntil', { date: formatDateTime(scheduledEnd) });
  }
  return t('portalRequests.labels.notScheduled');
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

function getConfidenceLevel(confidenceValue) {
  if (!Number.isFinite(confidenceValue)) return null;
  if (confidenceValue >= 0.8) {
    return { color: 'success', labelKey: 'portalRequests.elsa.confidenceLevel.high' };
  }
  if (confidenceValue >= 0.5) {
    return { color: 'warning', labelKey: 'portalRequests.elsa.confidenceLevel.medium' };
  }
  return { color: 'error', labelKey: 'portalRequests.elsa.confidenceLevel.low' };
}

function extractPlannedReply(decision) {
  const plannedReply = typeof decision?.tenant_reply_draft === 'string'
    ? decision.tenant_reply_draft
    : '';
  if (plannedReply) return plannedReply;

  const suggestionJson = typeof decision?.suggestion_json === 'string'
    ? decision.suggestion_json.trim()
    : '';
  if (!suggestionJson) return '';

  try {
    const parsed = JSON.parse(suggestionJson);
    return typeof parsed?.tenantReplyDraft === 'string' ? parsed.tenantReplyDraft : '';
  } catch {
    return '';
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

function NameWithRole({
  name,
  role,
  t,
  roleLabelOverride = '',
  chipColor = 'primary',
  chipVariant = 'outlined',
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
      <Chip
        label={roleLabelOverride || roleLabel(role, t)}
        size="small"
        color={chipColor}
        variant={chipVariant}
        sx={{ height: 20, fontSize: '0.7rem' }}
      />
    </Stack>
  );
}

function DetailRow({ label, value }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '11rem 1fr' },
        gap: 0.75,
        alignItems: 'start',
        py: { xs: 0.35, sm: 0.25 },
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: { xs: 1.55, sm: 1.45 } }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, lineHeight: { xs: 1.55, sm: 1.45 } }}>{value}</Box>
    </Box>
  );
}

function SectionCard({ children, sx = {}, ...boxProps }) {
  return (
    <Box
      {...boxProps}
      sx={(theme) => ({
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.75,
        p: { xs: 2, sm: 2.25 },
        backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.5 : 0.85),
        ...sx,
      })}
    >
      {children}
    </Box>
  );
}

const sectionHeadingSx = {
  fontSize: '1.1rem',
  lineHeight: { xs: 1.35, sm: 1.3 },
  letterSpacing: 0.1,
  mb: { xs: 0.25, sm: 0 },
};

function formatBytesToMbLabel(bytes) {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '0 MB';
  const mb = numeric / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

const RequestDetailPane = ({
  requestDetail,
  detailStatus,
  detailError,
  isManagement,
  isAdmin,
  managementForm,
  managementStatusOptions,
  managementPriorityOptions,
  onManagementField,
  onUpdateRequest,
  managementUpdateStatus,
  managementUpdateError,
  threadMessages,
  messageForm,
  setMessageForm,
  onMessageSubmit,
  messageStatus,
  messageError,
  messageDeleteStatus,
  messageDeleteError,
  onDeleteMessage,
  attachments,
  onAttachmentChange,
  onAttachmentSubmit,
  attachmentFile,
  attachmentStatus,
  attachmentError,
  attachmentUploadProgress,
  attachmentDeleteStatus,
  attachmentDeleteError,
  onDeleteAttachment,
  currentUserId,
  auditEvents,
  auditStatus,
  auditError,
  elsaSettingsError,
  elsaDecisionStatus,
  elsaDecisionError,
  elsaDecisionActionStatus,
  elsaDecisions,
  elsaAutoRespondEnabled,
  onSetElsaAutoRespond,
  onRunElsa,
  onReviewElsaDecision,
  onCancelRequest,
  cancelStatus,
  cancelError,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const requestPriorityTone = useMemo(() => priorityTone(requestDetail), [requestDetail]);
  const [activeTab, setActiveTab] = useState('details');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [managementDialogOpen, setManagementDialogOpen] = useState(false);
  const [deleteDialogMessage, setDeleteDialogMessage] = useState(null);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [pendingElsaAction, setPendingElsaAction] = useState(null);
  const [copyDismissDecision, setCopyDismissDecision] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [attachmentDeleteDialog, setAttachmentDeleteDialog] = useState(null);
  const [isAttachmentDropActive, setIsAttachmentDropActive] = useState(false);
  const managementStatusMessage = managementUpdateStatus === 'error'
    ? { severity: 'error', text: managementUpdateError || t('portalRequests.errors.saveFailed') }
    : null;
  const messageStatusMessage = messageStatus === 'error'
    ? { severity: 'error', text: messageError || t('portalRequests.errors.saveFailed') }
    : null;
  const messageDeleteStatusMessage = messageDeleteStatus === 'error'
    ? { severity: 'error', text: messageDeleteError || t('portalRequests.errors.saveFailed') }
    : null;
  const attachmentStatusMessage = attachmentStatus === 'error'
    && attachmentError
    && attachmentError !== t('portalRequests.errors.attachmentStorageUnavailable')
    ? { severity: 'error', text: attachmentError }
    : null;
  const attachmentDeleteStatusMessage = attachmentDeleteStatus === 'error'
    ? { severity: 'error', text: attachmentDeleteError || t('portalRequests.errors.saveFailed') }
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
    setDetailsExpanded(false);
  }, [requestDetail]);
  useEffect(() => {
    if (attachmentStatus !== 'success') return;
    setAttachmentInputKey((value) => value + 1);
  }, [attachmentStatus]);
  useEffect(() => {
    if (managementUpdateStatus !== 'success') return;
    setManagementDialogOpen(false);
  }, [managementUpdateStatus]);
  useEffect(() => {
    if (elsaDecisionActionStatus === 'saving') return;
    setPendingElsaAction(null);
  }, [elsaDecisionActionStatus]);

  const handleReviewElsaDecision = (decisionId, action) => {
    setPendingElsaAction({ decisionId, action });
    onReviewElsaDecision(decisionId, action);
  };
  const handleUseSuggestedReply = (decision, suggestedReply) => {
    setMessageForm((prev) => ({ ...prev, body: suggestedReply }));
    setCopyDismissDecision(decision);
  };
  const shouldOfferManualAction = (decision, plannedReply) => (
    Boolean(plannedReply)
    && (
      decision.policy_decision === 'BLOCK_AND_ALERT_ADMIN'
      || decision.policy_decision === 'HOLD_FOR_REVIEW'
      || Boolean(decision.recommended_next_action)
    )
  );
  const shouldOfferDismissAction = (decision) => !decision.reviewed_at;
  const isElsaActionSaving = (decisionId, action) => (
    elsaDecisionActionStatus === 'saving'
    && pendingElsaAction?.decisionId === decisionId
    && pendingElsaAction?.action === action
  );
  const canDeleteAttachment = (attachment) => (
    isManagement || isAdmin || attachment?.uploaded_by_user_id === currentUserId
  );
  const attachmentMediaLabel = (mediaType) => (
    mediaType === 'PHOTO'
      ? t('portalRequests.attachments.mediaImage')
      : mediaType === 'VIDEO'
        ? t('portalRequests.attachments.mediaVideo')
        : t('portalRequests.attachments.mediaFile')
  );
  const uploaderLabel = (attachment) => (
    attachment?.uploaded_by_display_name
    || attachment?.uploaded_by_user_id
    || t('portalRequests.messages.senderUnknown')
  );
  const attachmentMetaLabel = (attachment) => {
    const details = [attachmentMediaLabel(attachment?.media_type)];
    if (Number.isFinite(Number(attachment?.file_size_bytes))) {
      details.push(formatBytesToMbLabel(attachment.file_size_bytes));
    }
    details.push(uploaderLabel(attachment), formatDateTime(attachment?.created_at));
    return details.join(' · ');
  };

  return (
    <Stack spacing={2} sx={{ flex: 1 }}>
      <StatusAlertSlot
        message={
          cancelStatus === 'error'
            ? { severity: 'error', text: cancelError || t('portalRequests.errors.saveFailed') }
            : null
        }
      />
      {detailStatus === 'loading' && (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" variant="body2">{t('portalRequests.loading')}</Typography>
        </Stack>
      )}
      {detailStatus === 'error' && (
        <StatusAlertSlot
          message={{ severity: 'error', text: detailError || t('portalRequests.errors.loadFailed') }}
        />
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
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <CircularProgress size={18} />
                <Typography color="text.secondary" variant="body2">{t('portalRequests.audit.loading')}</Typography>
              </Stack>
            )}
            {auditStatus === 'error' && (
              <StatusAlertSlot
                message={{ severity: 'error', text: auditError || t('portalRequests.errors.loadFailed') }}
              />
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
      <SectionCard>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700 }}>{requestDetail.title}</Typography>
            {isManagement && (
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setManagementDialogOpen(true)}
                disabled={managementUpdateStatus === 'saving'}
                sx={{ minHeight: 36 }}
              >
                {t('portalRequests.actions.updateRequest')}
              </Button>
            )}
          </Stack>
          <Typography color="text.secondary">{requestDetail.description}</Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={requestDetail.status_name || requestDetail.status_code || '-'}
                variant="filled"
                sx={getStatusChipSx(requestDetail.status_code, theme)}
              />
              <Chip size="small" label={requestDetail.category_name || requestDetail.category_code || '-'} variant="outlined" />
              <Chip
                size="small"
                label={requestDetail.priority_name || requestDetail.priority_code || '-'}
                color={requestPriorityTone.chipColor}
                variant={requestPriorityTone.chipColor === 'default' ? 'outlined' : 'filled'}
              />
            </Stack>
            <Button
              type="button"
              size="small"
              variant="text"
              onClick={() => setDetailsExpanded((value) => !value)}
              aria-expanded={detailsExpanded}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              {detailsExpanded
                ? t('portalRequests.actions.hideDetails')
                : t('portalRequests.actions.showDetails')}
            </Button>
          </Stack>
          <Collapse in={detailsExpanded} unmountOnExit>
            <Box
              sx={(theme) => ({
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.25,
                p: 1.5,
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.03),
              })}
            >
              <Stack spacing={1.25}>
                <DetailRow
                  label={`${t('portalRequests.labels.requestId')}:`}
                  value={<Typography variant="body2">{requestDetail.id}</Typography>}
                />
                <DetailRow
                  label={`${t('portalRequests.labels.reportedBy')}:`}
                  value={(
                    <NameWithRole
                      name={displayNameWithFallback({
                        displayName: requestDetail.submitted_by_display_name,
                        userId: requestDetail.submitted_by_user_id,
                      }, t('portalRequests.messages.senderUnknown'))}
                      role={requestDetail.submitted_by_role}
                      t={t}
                    />
                  )}
                />
                <DetailRow
                  label={`${t('portalRequests.labels.scheduledWindow')}:`}
                  value={<Typography variant="body2">{formatScheduleWindow(requestDetail, t)}</Typography>}
                />
                <DetailRow
                  label={`${t('portalRequests.labels.vendorName')}:`}
                  value={<Typography variant="body2">{requestDetail.vendor_contact_name || '-'}</Typography>}
                />
                <DetailRow
                  label={`${t('portalRequests.labels.vendorPhone')}:`}
                  value={<Typography variant="body2">{requestDetail.vendor_contact_phone || '-'}</Typography>}
                />
                <DetailRow
                  label={`${t('portalRequests.labels.createdAt')}:`}
                  value={<Typography variant="body2">{formatDateTime(requestDetail.created_at)}</Typography>}
                />
                <DetailRow
                  label={`${t('portalRequests.labels.updatedAt')}:`}
                  value={<Typography variant="body2">{formatDateTime(requestDetail.updated_at)}</Typography>}
                />
              </Stack>
            </Box>
          </Collapse>
        </Stack>
      </SectionCard>

      {!isManagement && CANCELLABLE_STATUS_CODES.has((requestDetail.status_code || '').toUpperCase()) && (
        <SectionCard>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={sectionHeadingSx}>
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
                startIcon={cancelStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ minHeight: 40 }}
              >
                {cancelStatus === 'saving'
                  ? t('portalRequests.actions.saving')
                  : t('portalRequests.actions.cancelRequest')}
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
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

      <Dialog
        open={Boolean(copyDismissDecision)}
        onClose={() => {
          if (elsaDecisionActionStatus !== 'saving') setCopyDismissDecision(null);
        }}
      >
        <DialogTitle>{t('portalRequests.elsa.copyDialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('portalRequests.elsa.copyDialog.body')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => setCopyDismissDecision(null)}
            disabled={elsaDecisionActionStatus === 'saving'}
          >
            {t('portalRequests.elsa.copyDialog.keepOpen')}
          </Button>
          <Button
            type="button"
            color="warning"
            variant="contained"
            onClick={() => {
              if (!copyDismissDecision?.id) return;
              handleReviewElsaDecision(copyDismissDecision.id, 'DISMISS');
              setCopyDismissDecision(null);
            }}
            disabled={elsaDecisionActionStatus === 'saving'}
            startIcon={isElsaActionSaving(copyDismissDecision?.id, 'DISMISS') ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {t('portalRequests.elsa.copyDialog.dismissNow')}
          </Button>
        </DialogActions>
      </Dialog>

      {isManagement && (
        <Dialog
          open={managementDialogOpen}
          onClose={() => {
            if (managementUpdateStatus !== 'saving') setManagementDialogOpen(false);
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{t('portalRequests.management.dialogTitle')}</DialogTitle>
          <DialogContent dividers>
            <Box component="form" id="management-update-form" onSubmit={onUpdateRequest}>
              <Stack spacing={1.5}>
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
                <FormControl>
                  <InputLabel id="management-priority-code-label">{t('portalRequests.management.priorityCode')}</InputLabel>
                  <Select
                    labelId="management-priority-code-label"
                    label={t('portalRequests.management.priorityCode')}
                    value={managementForm.priority_code}
                    onChange={onManagementField('priority_code')}
                    disabled={managementUpdateStatus === 'saving'}
                  >
                    <MenuItem value="">{t('portalRequests.management.selectPriorityCode')}</MenuItem>
                    {(managementPriorityOptions || []).map((priority) => (
                      <MenuItem key={priority.code} value={priority.code}>
                        {priority.name}
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
                <InlineActionStatus message={managementStatusMessage} />
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={() => setManagementDialogOpen(false)}
              disabled={managementUpdateStatus === 'saving'}
            >
              {t('portalRequests.actions.close')}
            </Button>
            <Button
              type="submit"
              form="management-update-form"
              variant="contained"
              disabled={managementUpdateStatus === 'saving'}
              startIcon={managementUpdateStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {managementUpdateStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : t('portalRequests.actions.saveChanges')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {isManagement && (
        <SectionCard>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={sectionHeadingSx}>
              {t('portalRequests.elsa.heading')}
            </Typography>
            <Box
              sx={(theme) => ({
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.25,
                p: { xs: 1.25, sm: 1.5 },
                backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.24 : 0.55),
              })}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}
              >
                <FormControlLabel
                  control={(
                    <Switch
                      checked={Boolean(elsaAutoRespondEnabled)}
                      onChange={(event) => onSetElsaAutoRespond(event.target.checked)}
                    />
                  )}
                  label={t('portalRequests.elsa.autoRespondToggle')}
                  sx={{ mr: 0 }}
                />
                <Button
                  type="button"
                  variant="outlined"
                  onClick={onRunElsa}
                  disabled={elsaDecisionStatus === 'loading'}
                  startIcon={elsaDecisionStatus === 'loading' ? <CircularProgress size={16} /> : null}
                  sx={{ minHeight: 40, width: { xs: '100%', md: 'auto' } }}
                >
                  {elsaDecisionStatus === 'loading'
                    ? t('portalRequests.elsa.running')
                    : t('portalRequests.elsa.runNow')}
                </Button>
              </Stack>
            </Box>
            <StatusAlertSlot
              message={elsaSettingsError ? { severity: 'error', text: elsaSettingsError } : null}
            />
            <StatusAlertSlot
              message={elsaDecisionError ? { severity: 'error', text: elsaDecisionError } : null}
            />
            {(elsaDecisions || [])
              .filter((decision) => (
                (decision.policy_decision !== 'HOLD_FOR_REVIEW' || !decision.reviewed_at)
                && String(decision.review_status || '').toUpperCase() !== 'DISMISSED'
              ))
              .slice(0, 3)
              .map((decision) => {
                const plannedReply = extractPlannedReply(decision);
                const canUseSuggestedReply = shouldOfferManualAction(decision, plannedReply);
                const canDismissSuggestion = shouldOfferDismissAction(decision);
                const canMarkResolved = decision.policy_decision === 'HOLD_FOR_REVIEW' && !decision.reviewed_at;
                const hasElsaActions = canUseSuggestedReply || canDismissSuggestion || canMarkResolved;
                return (
              <Box
                key={decision.id}
                sx={(theme) => ({
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  p: { xs: 1.25, sm: 1.5 },
                  backgroundColor: alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.14 : 0.05),
                })}
              >
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={decision.policy_decision === 'SEND_AUTOMATICALLY'
                          ? t('portalRequests.elsa.badges.autoSent')
                          : decision.policy_decision === 'BLOCK_AND_ALERT_ADMIN'
                            ? t('portalRequests.elsa.badges.blocked')
                            : t('portalRequests.elsa.badges.held')}
                        color={decision.policy_decision === 'SEND_AUTOMATICALLY'
                          ? 'success'
                          : decision.policy_decision === 'BLOCK_AND_ALERT_ADMIN'
                            ? 'error'
                            : 'warning'}
                      />
                      {decision.mode ? (
                        <Chip
                          size="small"
                          label={ELSA_MODE_LABEL_KEYS[decision.mode]
                            ? t(ELSA_MODE_LABEL_KEYS[decision.mode])
                            : decision.mode}
                          variant="outlined"
                        />
                      ) : null}
                      {(() => {
                        const confidenceLevel = getConfidenceLevel(Number(decision.confidence));
                        if (!confidenceLevel) return null;
                        return (
                          <Chip
                            size="small"
                            color={confidenceLevel.color}
                            label={t(confidenceLevel.labelKey)}
                          />
                        );
                      })()}
                    </Stack>
                    {decision.created_at && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ marginInlineStart: 'auto', whiteSpace: 'nowrap' }}
                      >
                        {t('portalRequests.elsa.generatedAt')}: {formatDateTime(decision.created_at)}
                      </Typography>
                    )}
                  </Box>
                  {plannedReply && (
                    <Box
                      sx={(theme) => ({
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1,
                        borderInlineStartWidth: 3,
                        borderInlineStartStyle: 'solid',
                        borderInlineStartColor: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.34 : 0.66),
                      })}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                        {t('portalRequests.elsa.plannedReply')}
                      </Typography>
                      <Typography variant="body2">{plannedReply}</Typography>
                    </Box>
                  )}
                  {decision.internal_summary && (
                    <Typography variant="body2" color="text.secondary">
                      {decision.internal_summary}
                    </Typography>
                  )}
                  {decision.recommended_next_action && (
                    <Typography variant="caption" color="text.secondary">
                      {t('portalRequests.elsa.nextAction')}: {decision.recommended_next_action}
                    </Typography>
                  )}
                  {hasElsaActions && (
                    <>
                      <Divider />
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flexWrap: 'nowrap', alignItems: 'center', overflowX: 'auto', pb: 0.25 }}
                      >
                        {canUseSuggestedReply && (
                          <Button
                            type="button"
                            size="small"
                            variant="contained"
                            onClick={() => handleReviewElsaDecision(decision.id, 'SEND_AND_RESOLVE')}
                            disabled={elsaDecisionActionStatus === 'saving'}
                            startIcon={isElsaActionSaving(decision.id, 'SEND_AND_RESOLVE') ? <CircularProgress size={14} color="inherit" /> : null}
                            sx={{ minHeight: 36, flexShrink: 0 }}
                          >
                            {t('portalRequests.elsa.actions.sendAndResolve')}
                          </Button>
                        )}
                        {canUseSuggestedReply && (
                          <Button
                            type="button"
                            size="small"
                            variant="outlined"
                            onClick={() => handleUseSuggestedReply(decision, plannedReply)}
                            disabled={elsaDecisionActionStatus === 'saving'}
                            sx={{ minHeight: 36, flexShrink: 0 }}
                          >
                            {t('portalRequests.elsa.actions.copyToMessage')}
                          </Button>
                        )}
                        {canDismissSuggestion && (
                          <Button
                            type="button"
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() => handleReviewElsaDecision(decision.id, 'DISMISS')}
                            disabled={elsaDecisionActionStatus === 'saving'}
                            startIcon={isElsaActionSaving(decision.id, 'DISMISS') ? <CircularProgress size={14} color="inherit" /> : null}
                            sx={{ minHeight: 36, flexShrink: 0 }}
                          >
                            {t('portalRequests.elsa.actions.dismiss')}
                          </Button>
                        )}
                        {canMarkResolved && (
                          <Button
                            type="button"
                            size="small"
                            variant="outlined"
                            onClick={() => handleReviewElsaDecision(decision.id, 'MARK_RESOLVED')}
                            disabled={elsaDecisionActionStatus === 'saving'}
                            startIcon={isElsaActionSaving(decision.id, 'MARK_RESOLVED') ? <CircularProgress size={14} color="inherit" /> : null}
                            sx={{ minHeight: 36, flexShrink: 0 }}
                          >
                            {t('portalRequests.elsa.actions.markResolved')}
                          </Button>
                        )}
                      </Stack>
                    </>
                  )}
                  {decision.reviewed_at && (
                    <Typography variant="caption" color="text.secondary">
                      {t('portalRequests.elsa.reviewedBadge', {
                        status: decision.review_status || t('portalRequests.elsa.resolved'),
                      })}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
            })}
          </Stack>
        </SectionCard>
      )}

      <SectionCard
        component="form"
        onSubmit={onMessageSubmit}
      >
        <Stack spacing={1.5}>
          <Typography variant="h3" sx={sectionHeadingSx}>
            {t('portalRequests.messages.heading')}
          </Typography>
          <Box
            sx={(theme) => ({
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.25,
              p: 1.5,
              backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.32 : 0.65),
            })}
          >
            <Stack spacing={1}>
              {threadMessages.length === 0 && (
                <Typography color="text.secondary">{t('portalRequests.messages.empty')}</Typography>
              )}
              {threadMessages.map((msg) => (
                <Box
                  key={msg.id}
                  sx={(theme) => ({
                    border: '1px solid',
                    borderColor: msg.is_internal ? 'warning.main' : 'divider',
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: msg.is_internal
                      ? alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.22 : 0.12)
                      : 'transparent',
                  })}
                >
                  {/*
                    Elsa auto-sent messages are persisted with source=SYSTEM.
                    Render a stable assistant identity regardless of actor user metadata.
                  */}
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                    {msg.is_internal && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="filled"
                        label={t('portalRequests.messages.internalTag')}
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}
                      />
                    )}
                    {(() => {
                      const isElsaAutoMessage = msg.source === 'SYSTEM' || msg.source === 'ELSA_AUTO_SENT';
                      const senderName = isElsaAutoMessage
                        ? t('portalRequests.messages.elsaName')
                        : displayNameWithFallback({
                          displayName: msg.sender_display_name,
                          email: msg.sender_email,
                          userId: msg.sender_user_id,
                        }, t('portalRequests.messages.senderUnknown'));
                      return (
                        <NameWithRole
                          name={senderName}
                          role={msg.sender_role}
                          t={t}
                          roleLabelOverride={isElsaAutoMessage ? t('portalRequests.messages.aiAssistantRole') : ''}
                          chipColor={isElsaAutoMessage ? 'secondary' : 'primary'}
                          chipVariant={isElsaAutoMessage ? 'filled' : 'outlined'}
                        />
                      );
                    })()}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {formatDateTime(msg.created_at)}
                  </Typography>
                  {msg.source === 'SYSTEM' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {t('portalRequests.elsa.timeline.autoSentByElsa')}
                    </Typography>
                  )}
                  <Typography color="text.secondary">{msg.body}</Typography>
                  {isAdmin && (
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.75 }}>
                      <Button
                        type="button"
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialogMessage(msg)}
                        disabled={messageDeleteStatus === 'saving'}
                        sx={{ minHeight: 32 }}
                      >
                        {t('portalRequests.messages.deleteAction')}
                      </Button>
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
          <Dialog open={Boolean(deleteDialogMessage)} onClose={() => setDeleteDialogMessage(null)}>
            <DialogTitle>{t('portalRequests.messages.deleteConfirmTitle')}</DialogTitle>
            <DialogContent>
              <DialogContentText>{t('portalRequests.messages.deleteConfirmBody')}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => setDeleteDialogMessage(null)}>
                {t('portalRequests.messages.deleteConfirmNo')}
              </Button>
              <Button
                type="button"
                color="error"
                variant="contained"
                onClick={async () => {
                  const messageId = deleteDialogMessage?.id;
                  setDeleteDialogMessage(null);
                  if (messageId) await onDeleteMessage(messageId);
                }}
              >
                {t('portalRequests.messages.deleteConfirmYes')}
              </Button>
            </DialogActions>
          </Dialog>
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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <InlineActionStatus message={messageDeleteStatusMessage || messageStatusMessage} />
            <Button
              type="submit"
              variant="contained"
              disabled={messageStatus === 'saving'}
              startIcon={messageStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ minHeight: 40, width: { xs: '100%', sm: 'auto' } }}
            >
              {messageStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : t('portalRequests.actions.sendMessage')}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard
        component="form"
        onSubmit={onAttachmentSubmit}
      >
        <Stack spacing={1.5}>
          <Typography variant="h3" sx={sectionHeadingSx}>
            {t('portalRequests.attachments.heading')}
          </Typography>
          <Box
            sx={(theme) => ({
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.25,
              p: 1.5,
              backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.32 : 0.65),
            })}
          >
            <Stack spacing={0.75}>
              {attachments.length === 0 && (
                <Typography color="text.secondary">{t('portalRequests.attachments.empty')}</Typography>
              )}
              {attachments.map((att) => (
                <Box
                  key={att.id}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.25 }}
                >
                  <Stack spacing={0.75}>
                    {att.file_url && att.media_type === 'PHOTO' && (
                      <Box
                        component="img"
                        src={att.file_url}
                        alt={att.original_filename}
                        sx={{
                          width: '100%',
                          maxHeight: 220,
                          objectFit: 'cover',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    )}
                    {att.file_url && att.media_type === 'VIDEO' && (
                      <Box
                        component="video"
                        controls
                        preload="metadata"
                        src={att.file_url}
                        sx={{
                          width: '100%',
                          maxHeight: 260,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    )}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {att.original_filename}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {attachmentMetaLabel(att)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {att.file_url ? (
                          <Button
                            component="a"
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                            sx={{ textTransform: 'none' }}
                          >
                            {t('portalRequests.attachments.download')}
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {t('portalRequests.attachments.unavailable')}
                          </Typography>
                        )}
                        {canDeleteAttachment(att) && (
                          <Button
                            type="button"
                            size="small"
                            color="error"
                            onClick={() => setAttachmentDeleteDialog(att)}
                            disabled={attachmentDeleteStatus === 'saving'}
                            sx={{ textTransform: 'none' }}
                          >
                            {t('portalRequests.attachments.deleteAction')}
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
          <Box
            onDragOver={(event) => {
              event.preventDefault();
              setIsAttachmentDropActive(true);
            }}
            onDragLeave={() => setIsAttachmentDropActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsAttachmentDropActive(false);
              const file = event.dataTransfer?.files?.[0];
              if (file) onAttachmentChange({ target: { files: [file] } });
            }}
            sx={(theme) => ({
              border: '1px dashed',
              borderColor: isAttachmentDropActive ? 'primary.main' : 'divider',
              borderRadius: 1.25,
              p: 1.25,
              backgroundColor: isAttachmentDropActive
                ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                : 'transparent',
            })}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
              <Button
                variant="outlined"
                component="label"
                type="button"
                sx={{ minHeight: 40, width: { xs: '100%', sm: 'auto' } }}
              >
                {t('portalRequests.actions.chooseFile')}
                <input key={attachmentInputKey} type="file" hidden accept="image/*,video/*" onChange={onAttachmentChange} />
              </Button>
              <Typography variant="caption" color="text.secondary">
                {t('portalRequests.attachments.instructions')}
              </Typography>
            </Stack>
          </Box>
          {attachmentFile && (
            <Typography color="text.secondary">
              {attachmentFile.name} ({formatBytesToMbLabel(attachmentFile.size)})
            </Typography>
          )}
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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <InlineActionStatus message={attachmentDeleteStatusMessage || attachmentStatusMessage} />
            <Button
              type="submit"
              variant="contained"
              disabled={!attachmentFile || attachmentStatus === 'saving'}
              startIcon={attachmentStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ minHeight: 40, width: { xs: '100%', sm: 'auto' } }}
            >
              {attachmentStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : attachmentStatus === 'error'
                  ? t('portalRequests.attachments.retryUpload')
                  : t('portalRequests.actions.attachFile')}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
      <Dialog open={Boolean(attachmentDeleteDialog)} onClose={() => setAttachmentDeleteDialog(null)}>
        <DialogTitle>{t('portalRequests.attachments.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('portalRequests.attachments.deleteConfirmBody')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setAttachmentDeleteDialog(null)}>
            {t('portalRequests.attachments.deleteConfirmNo')}
          </Button>
          <Button
            type="button"
            color="error"
            variant="contained"
            disabled={attachmentDeleteStatus === 'saving'}
            onClick={async () => {
              const attachmentId = attachmentDeleteDialog?.id;
              setAttachmentDeleteDialog(null);
              if (attachmentId) await onDeleteAttachment(attachmentId);
            }}
          >
            {t('portalRequests.attachments.deleteConfirmYes')}
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}
      </>
      )}
    </Stack>
  );
};

export default RequestDetailPane;

