import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
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
  IconButton,
  MenuItem,
  Select,
  Switch,
  LinearProgress,
  Tab,
  Tabs,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import InlineActionStatus from '../InlineActionStatus';
import PortalConfirmDialog from '../PortalConfirmDialog';
import PortalUserAvatar from '../PortalUserAvatar';
import { AttachmentUploadControl } from '..';
import { RequestStatus, Role } from '../../domain/constants.js';
import { normalizeRole } from '../../portalUtils';
import { getStatusChipSx } from './requestChipStyles';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
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

function timestampMs(value) {
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
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
  avatar = null,
  roleChipTooltip = '',
}) {
  const chipLabel = roleLabelOverride || roleLabel(role, t);
  const chip = (
    <Chip
      label={chipLabel}
      size="small"
      color={chipColor}
      variant={chipVariant}
      sx={{ height: 20, fontSize: '0.7rem' }}
    />
  );
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
      {avatar}
      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
      {roleChipTooltip ? (
        <Tooltip title={roleChipTooltip}>
          <Box component="span" sx={{ display: 'inline-flex', maxWidth: '100%' }}>
            {chip}
          </Box>
        </Tooltip>
      ) : (
        chip
      )}
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

/** Left column width for request message thread (aligned name + date beside avatar). */
const MESSAGE_THREAD_AVATAR_PX = 48;

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
  onClearAttachmentFile,
  onAttachmentSubmit,
  attachmentFile,
  attachmentStatus,
  attachmentError,
  attachmentRetryHint,
  attachmentErrorDebugId,
  attachmentUploadProgress,
  attachmentDeleteStatus,
  attachmentDeleteError,
  onDeleteAttachment,
  onShareAttachment,
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
  const isDev = import.meta.env.DEV;
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
  const [mediaPreviewIndex, setMediaPreviewIndex] = useState(-1);
  const [managementDiscardOpen, setManagementDiscardOpen] = useState(false);
  const managementBaselineRef = useRef('');
  const [attachmentShareState, setAttachmentShareState] = useState({ status: 'idle', message: '', attachmentId: '' });
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
  const attachmentShareStatusMessage = attachmentShareState.status === 'error'
    ? { severity: 'error', text: attachmentShareState.message || t('portalRequests.errors.saveFailed') }
    : attachmentShareState.status === 'success'
      ? { severity: 'success', text: attachmentShareState.message || t('portalRequests.attachments.shareCopied') }
      : null;
  const sortedManagementStatusOptions = useMemo(
    () =>
      [...(managementStatusOptions || [])].sort((a, b) => {
        const aCode = String(a ?? '');
        const bCode = String(b ?? '');
        const aLabel = t(`portalRequests.statuses.${aCode.toUpperCase()}`, { defaultValue: aCode });
        const bLabel = t(`portalRequests.statuses.${bCode.toUpperCase()}`, { defaultValue: bCode });
        return collator.compare(aLabel, bLabel);
      }),
    [managementStatusOptions, t]
  );
  const sortedManagementPriorityOptions = useMemo(
    () =>
      [...(managementPriorityOptions || [])].sort((a, b) =>
        collator.compare(String(a?.name ?? a?.code ?? ''), String(b?.name ?? b?.code ?? ''))
      ),
    [managementPriorityOptions]
  );
  const sortedThreadMessages = useMemo(
    () =>
      [...threadMessages].sort((a, b) => {
        const byCreated = timestampMs(a?.created_at) - timestampMs(b?.created_at);
        if (byCreated !== 0) return byCreated;
        return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
      }),
    [threadMessages]
  );
  const sortedAttachments = useMemo(
    () =>
      [...attachments].sort((a, b) => {
        const byCreated = timestampMs(a?.created_at) - timestampMs(b?.created_at);
        if (byCreated !== 0) return byCreated;
        return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
      }),
    [attachments]
  );
  const sortedElsaDecisions = useMemo(
    () =>
      [...(elsaDecisions || [])]
        .sort((a, b) => {
          const byCreated = timestampMs(b?.created_at) - timestampMs(a?.created_at);
          if (byCreated !== 0) return byCreated;
          return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
        })
        .filter((decision) => (
          (decision.policy_decision !== 'HOLD_FOR_REVIEW' || !decision.reviewed_at)
          && String(decision.review_status || '').toUpperCase() !== 'DISMISSED'
        ))
        .slice(0, 3),
    [elsaDecisions]
  );
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
    }).sort((a, b) => {
      const byCreated = timestampMs(b?.created_at) - timestampMs(a?.created_at);
      if (byCreated !== 0) return byCreated;
      return collator.compare(String(a?.id ?? ''), String(b?.id ?? ''));
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
    details.push(formatDateTime(attachment?.created_at));
    return details.join(' · ');
  };
  const previewableAttachments = useMemo(
    () => attachments.filter((attachment) => (
      Boolean(attachment?.file_url)
      && (attachment?.media_type === 'PHOTO' || attachment?.media_type === 'VIDEO')
    )),
    [attachments]
  );
  const activePreviewAttachment = mediaPreviewIndex >= 0
    ? previewableAttachments[mediaPreviewIndex] ?? null
    : null;
  const canPreviewPrevious = mediaPreviewIndex > 0;
  const canPreviewNext = mediaPreviewIndex >= 0 && mediaPreviewIndex < previewableAttachments.length - 1;
  const copyTextWithFallback = async (text, promptMessage) => {
    const fallbackCopy = () => {
      window.prompt(promptMessage, text);
      return false;
    };
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        copied = fallbackCopy();
      }
    } catch {
      copied = fallbackCopy();
    }
    return copied;
  };
  const handleCopyAttachmentLink = async (attachment) => {
    const fileUrl = attachment?.file_url;
    if (!fileUrl) return;
    const copied = await copyTextWithFallback(fileUrl, t('portalRequests.attachments.linkPrompt'));
    setAttachmentShareState({
      status: 'success',
      message: copied
        ? t('portalRequests.attachments.linkCopied')
        : t('portalRequests.attachments.linkPromptFallback'),
      attachmentId: attachment?.id || '',
    });
  };
  const handleShareAttachment = async (attachmentId) => {
    if (!attachmentId || !onShareAttachment) return;
    setAttachmentShareState({ status: 'saving', message: '', attachmentId });
    const result = await onShareAttachment(attachmentId);
    if (!result?.shareUrl) {
      setAttachmentShareState({
        status: 'error',
        message: t('portalRequests.attachments.shareUnavailable'),
        attachmentId,
      });
      return;
    }
    const copied = await copyTextWithFallback(result.shareUrl, t('portalRequests.attachments.sharePrompt'));
    setAttachmentShareState({
      status: copied ? 'success' : 'success',
      message: copied
        ? t('portalRequests.attachments.shareCopied')
        : t('portalRequests.attachments.sharePromptFallback'),
      attachmentId,
    });
  };
  useEffect(() => {
    if (!activePreviewAttachment) return;
    const nextIndex = previewableAttachments.findIndex(
      (attachment) => attachment.id === activePreviewAttachment.id
    );
    setMediaPreviewIndex(nextIndex);
  }, [activePreviewAttachment, previewableAttachments]);
  const openMediaPreview = (attachmentId) => {
    const nextIndex = previewableAttachments.findIndex((attachment) => attachment.id === attachmentId);
    if (nextIndex < 0) return;
    setMediaPreviewIndex(nextIndex);
  };
  const closeMediaPreview = () => {
    setMediaPreviewIndex(-1);
  };
  const managementSnapshot = JSON.stringify(managementForm || {});
  const hasManagementUnsavedChanges = managementDialogOpen
    && managementBaselineRef.current
    && managementSnapshot !== managementBaselineRef.current;
  const openManagementDialog = () => {
    managementBaselineRef.current = managementSnapshot;
    setManagementDialogOpen(true);
  };
  const attemptCloseManagementDialog = () => {
    if (managementUpdateStatus === 'saving') return;
    if (hasManagementUnsavedChanges) {
      setManagementDiscardOpen(true);
      return;
    }
    setManagementDialogOpen(false);
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
      {isManagement && (
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          aria-label={t('portalRequests.audit.tabsLabel')}
        >
          <Tab value="details" label={t('portalRequests.audit.detailsTab')} />
          <Tab value="audit" label={t('portalRequests.audit.auditTab')} />
        </Tabs>
      )}

      {isManagement && activeTab === 'audit' ? (
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
                onClick={openManagementDialog}
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
                      avatar={(
                        <PortalUserAvatar
                          photoUrl={requestDetail.submitted_by_profile_photo_url ?? ''}
                          firstName={requestDetail.submitted_by_first_name ?? ''}
                          lastName={requestDetail.submitted_by_last_name ?? ''}
                          size={28}
                        />
                      )}
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
        <>
          <Dialog
            open={managementDialogOpen}
            onClose={() => {
              attemptCloseManagementDialog();
            }}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography component="span">{t('portalRequests.management.dialogTitle')}</Typography>
              <IconButton
                type="button"
                size="small"
                onClick={attemptCloseManagementDialog}
                disabled={managementUpdateStatus === 'saving'}
                aria-label={t('portalDialogs.closeForm')}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
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
                    {sortedManagementStatusOptions.map((statusCode) => (
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
                    {sortedManagementPriorityOptions.map((priority) => (
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
                onClick={attemptCloseManagementDialog}
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
          <PortalConfirmDialog
            open={managementDiscardOpen}
            onClose={() => setManagementDiscardOpen(false)}
            onConfirm={() => {
              setManagementDiscardOpen(false);
              setManagementDialogOpen(false);
            }}
            title={t('portalDialogs.unsavedChanges.title')}
            body={t('portalDialogs.unsavedChanges.body')}
            confirmLabel={t('portalDialogs.unsavedChanges.discard')}
            cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
            confirmColor="warning"
          />
        </>
      )}

      {isManagement && (
        <SectionCard>
          <Stack spacing={1.5}>
            <Typography
              variant="h3"
              sx={{
                ...sectionHeadingSx,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <SmartToyIcon
                sx={{ fontSize: '1.35rem', color: 'secondary.main', flexShrink: 0 }}
                aria-hidden
              />
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
            {sortedElsaDecisions.map((decision) => {
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
                    <SmartToyIcon
                      sx={{
                        fontSize: 24,
                        color: 'secondary.main',
                        flexShrink: 0,
                        alignSelf: { xs: 'flex-start', sm: 'center' },
                        mt: { xs: 0.2, sm: 0 },
                      }}
                      aria-hidden
                    />
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
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
                        sx={{
                          flexShrink: 0,
                          marginInlineStart: 'auto',
                          whiteSpace: 'nowrap',
                          alignSelf: { xs: 'flex-start', sm: 'center' },
                        }}
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
              {sortedThreadMessages.length === 0 && (
                <Typography color="text.secondary">{t('portalRequests.messages.empty')}</Typography>
              )}
              {sortedThreadMessages.map((msg) => (
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
                      <Stack spacing={0.75} sx={{ width: '100%' }}>
                        <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ width: '100%' }}>
                          <Box sx={{ flexShrink: 0, width: MESSAGE_THREAD_AVATAR_PX, display: 'flex', justifyContent: 'center' }}>
                            {isElsaAutoMessage ? (
                              <Avatar
                                variant="circular"
                                sx={{
                                  width: MESSAGE_THREAD_AVATAR_PX,
                                  height: MESSAGE_THREAD_AVATAR_PX,
                                  bgcolor: 'secondary.main',
                                  color: 'secondary.contrastText',
                                }}
                                aria-hidden
                              >
                                <SmartToyIcon sx={{ fontSize: MESSAGE_THREAD_AVATAR_PX * 0.55 }} aria-hidden />
                              </Avatar>
                            ) : (
                              <PortalUserAvatar
                                photoUrl={msg.sender_profile_photo_url ?? ''}
                                firstName={msg.sender_first_name ?? ''}
                                lastName={msg.sender_last_name ?? ''}
                                size={MESSAGE_THREAD_AVATAR_PX}
                              />
                            )}
                          </Box>
                          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0, alignItems: 'stretch' }}>
                            <Stack
                              direction="row"
                              alignItems="flex-start"
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Stack spacing={0.35} sx={{ alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
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
                                  <NameWithRole
                                    name={senderName}
                                    role={msg.sender_role}
                                    t={t}
                                    roleLabelOverride={isElsaAutoMessage ? t('portalRequests.messages.aiAssistantRole') : ''}
                                    chipColor={isElsaAutoMessage ? 'secondary' : 'primary'}
                                    chipVariant={isElsaAutoMessage ? 'filled' : 'outlined'}
                                    roleChipTooltip={
                                      isElsaAutoMessage
                                        ? t('portalRequests.elsa.timeline.autoSentByElsa')
                                        : ''
                                    }
                                  />
                                </Stack>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {formatDateTime(msg.created_at)}
                                </Typography>
                              </Stack>
                              {isAdmin && (
                                <Tooltip title={t('portalRequests.messages.deleteAction')}>
                                  <Box component="span" sx={{ flexShrink: 0, lineHeight: 0 }}>
                                    <IconButton
                                      type="button"
                                      size="small"
                                      color="error"
                                      onClick={() => setDeleteDialogMessage(msg)}
                                      disabled={messageDeleteStatus === 'saving'}
                                      aria-label={t('portalRequests.messages.deleteAction')}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Tooltip>
                              )}
                            </Stack>
                          </Stack>
                        </Stack>
                        <Typography
                          color="text.secondary"
                          sx={{
                            width: '100%',
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {msg.body}
                        </Typography>
                      </Stack>
                    );
                  })()}
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
              {sortedAttachments.length === 0 && (
                <Box
                  sx={(theme) => ({
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1.25,
                    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.2 : 0.7),
                  })}
                >
                  <Typography color="text.secondary">{t('portalRequests.attachments.empty')}</Typography>
                </Box>
              )}
              {sortedAttachments.map((att) => (
                <Box
                  key={att.id}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.25 }}
                >
                  <Stack spacing={0.75}>
                    {att.file_url && att.media_type === 'PHOTO' && (
                      <Box
                        component="button"
                        type="button"
                        onClick={() => openMediaPreview(att.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openMediaPreview(att.id);
                          }
                        }}
                        aria-label={`${t('portalRequests.attachments.preview')}: ${att.original_filename}`}
                        sx={{
                          p: 0,
                          border: 'none',
                          background: 'transparent',
                          width: '100%',
                          textAlign: 'inherit',
                          cursor: 'zoom-in',
                        }}
                      >
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
                      </Box>
                    )}
                    {att.file_url && att.media_type === 'VIDEO' && (
                      <Box
                        component="video"
                        controls
                        preload="metadata"
                        src={att.file_url}
                        aria-label={`${t('portalRequests.attachments.previewVideoLabel')}: ${att.original_filename}`}
                        sx={{
                          width: '100%',
                          maxHeight: 260,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
                        >
                          {att.original_filename}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ marginInlineStart: 'auto', flexShrink: 0 }}>
                          {att.file_url && (
                            <Tooltip title={t('portalRequests.attachments.download')}>
                              <IconButton
                                component="a"
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                aria-label={`${t('portalRequests.attachments.download')}: ${att.original_filename}`}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {att.file_url && (
                            <Tooltip title={t('portalRequests.attachments.copyLink')}>
                              <span>
                                <IconButton
                                  type="button"
                                  size="small"
                                  onClick={() => handleCopyAttachmentLink(att)}
                                  aria-label={t('portalRequests.attachments.copyLinkAria', { filename: att.original_filename })}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {canDeleteAttachment(att) && (
                            <Tooltip title={t('portalRequests.attachments.deleteAction')}>
                              <span>
                                <IconButton
                                  type="button"
                                  size="small"
                                  color="error"
                                  onClick={() => setAttachmentDeleteDialog(att)}
                                  disabled={attachmentDeleteStatus === 'saving'}
                                  aria-label={t('portalRequests.attachments.deleteAction')}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {attachmentMetaLabel(att)}
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {uploaderLabel(att)}
                        </Typography>
                        <Chip
                          label={roleLabel(att?.uploaded_by_role, t)}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Stack>
                      {!att.file_url && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {t('portalRequests.attachments.unavailable')}
                        </Typography>
                      )}
                      {isManagement && (
                        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.5 }}>
                          <Button
                            type="button"
                            size="small"
                            onClick={() => handleShareAttachment(att.id)}
                            disabled={attachmentShareState.status === 'saving'}
                            sx={{ textTransform: 'none' }}
                          >
                            {attachmentShareState.status === 'saving'
                              && attachmentShareState.attachmentId === att.id
                              ? t('portalRequests.actions.saving')
                              : t('portalRequests.attachments.share')}
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
          <AttachmentUploadControl
            instructions={t('portalRequests.attachments.instructions')}
            isDropActive={isAttachmentDropActive}
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
            chooseButtonLabel={t('portalRequests.actions.chooseFile')}
            inputKey={attachmentInputKey}
            accept="image/*,video/*"
            onFileChange={onAttachmentChange}
            selectedContent={attachmentFile ? (
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1.25,
                  py: 0.75,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                }}
              >
                <AttachFileIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {t('portalRequests.attachments.selectedFileLabel')}: {attachmentFile.name} ({formatBytesToMbLabel(attachmentFile.size)})
                </Typography>
                <Tooltip title={t('portalRequests.create.removeAttachment')}>
                  <Button
                    type="button"
                    size="small"
                    onClick={() => {
                      onClearAttachmentFile();
                      setAttachmentInputKey((value) => value + 1);
                    }}
                    aria-label={t('portalRequests.create.removeAttachment')}
                    sx={{ minWidth: 'auto', px: 1 }}
                  >
                    <CloseIcon fontSize="small" />
                  </Button>
                </Tooltip>
              </Box>
            ) : null}
            trailingAction={(
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
            )}
          />
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
              {attachmentRetryHint ? (
                <Typography variant="caption" color="text.secondary">
                  {attachmentRetryHint}
                </Typography>
              ) : null}
            </Stack>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <InlineActionStatus
              message={
                attachmentDeleteStatusMessage
                || attachmentStatusMessage
                || attachmentShareStatusMessage
              }
            />
            {isDev && attachmentStatus === 'error' && attachmentErrorDebugId ? (
              <Typography variant="caption" color="text.secondary">
                {t('portalRequests.attachments.debugIdLabel')}: {attachmentErrorDebugId}
              </Typography>
            ) : null}
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
      <Dialog
        open={Boolean(activePreviewAttachment)}
        onClose={closeMediaPreview}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activePreviewAttachment?.original_filename || t('portalRequests.attachments.heading')}
          </Typography>
          <IconButton
            type="button"
            onClick={closeMediaPreview}
            aria-label={t('portalRequests.actions.close')}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {activePreviewAttachment?.file_url && activePreviewAttachment.media_type === 'PHOTO' && (
            <Box
              component="img"
              src={activePreviewAttachment.file_url}
              alt={activePreviewAttachment.original_filename}
              sx={{
                width: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                display: 'block',
                marginInline: 'auto',
              }}
            />
          )}
          {activePreviewAttachment?.file_url && activePreviewAttachment.media_type === 'VIDEO' && (
            <Box
              component="video"
              controls
              preload="metadata"
              src={activePreviewAttachment.file_url}
              aria-label={`${t('portalRequests.attachments.previewVideoLabel')}: ${activePreviewAttachment.original_filename}`}
              sx={{
                width: '100%',
                maxHeight: '75vh',
                display: 'block',
                marginInline: 'auto',
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Typography variant="caption" color="text.secondary" sx={{ marginInlineEnd: 'auto', px: 1 }}>
            {t('portalRequests.attachments.previewPosition', {
              index: Math.max(1, mediaPreviewIndex + 1),
              count: previewableAttachments.length,
            })}
          </Typography>
          {activePreviewAttachment?.file_url && (
            <>
              <Tooltip title={t('portalRequests.attachments.download')}>
                <IconButton
                  component="a"
                  href={activePreviewAttachment.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t('portalRequests.attachments.download')}: ${activePreviewAttachment.original_filename}`}
                  size="small"
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('portalRequests.attachments.copyLink')}>
                <IconButton
                  type="button"
                  onClick={() => handleCopyAttachmentLink(activePreviewAttachment)}
                  aria-label={t('portalRequests.attachments.copyLinkAria', {
                    filename: activePreviewAttachment.original_filename,
                  })}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {canDeleteAttachment(activePreviewAttachment) && (
                <Tooltip title={t('portalRequests.attachments.deleteAction')}>
                  <span>
                    <IconButton
                      type="button"
                      color="error"
                      onClick={() => setAttachmentDeleteDialog(activePreviewAttachment)}
                      disabled={attachmentDeleteStatus === 'saving'}
                      aria-label={t('portalRequests.attachments.deleteAction')}
                      size="small"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </>
          )}
          <Tooltip title={t('portalRequests.attachments.previous')}>
            <span>
              <IconButton
                type="button"
                disabled={!canPreviewPrevious}
                onClick={() => setMediaPreviewIndex((value) => value - 1)}
                aria-label={t('portalRequests.attachments.previous')}
                size="small"
              >
                <NavigateBeforeIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('portalRequests.attachments.next')}>
            <span>
              <IconButton
                type="button"
                disabled={!canPreviewNext}
                onClick={() => setMediaPreviewIndex((value) => value + 1)}
                aria-label={t('portalRequests.attachments.next')}
                size="small"
              >
                <NavigateNextIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
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

