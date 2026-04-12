import { useEffect, useMemo, useRef, useState } from 'react';
import { emailFromAccount } from '../../portalUtils';
import {
  fetchRequestDetail,
  fetchRequests,
  fetchRequestLookups,
  createRequest,
  cancelRequest,
  postMessage,
  requestUploadIntent,
  putBlobToStorage,
  finalizeUpload,
  patchResource,
  fetchElsaDecisions,
  fetchElsaSettings,
  patchElsaRequestAutoRespond,
  patchElsaCategoryPolicy,
  patchElsaPriorityPolicy,
  patchElsaSettings,
  processElsaRequest,
  summarizeElsaRequest,
  patchElsaDecisionReview,
  fetchExportCsv,
  fetchRequestAudit,
  fetchRequestMessages,
  deleteRequestMessage,
  deleteRequestAttachment,
  createRequestAttachmentShareLink,
  fetchRequestAttachmentFileWithToken,
} from '../../lib/portalApiClient';
import { mergePolledRequestMessages } from '../../lib/mergePolledRequestMessages.js';
import { RequestStatus } from '../../domain/constants.js';
import { FALLBACK_MAX_IMAGE_BYTES } from '../../attachmentUploadLimits.js';
import { MESSAGES_POLL_INTERVAL_MS } from '../../featureFlags';
const MESSAGE_SUCCESS_AUTO_DISMISS_MS = 5000;
const ELSA_DECISION_ACTION_SUCCESS_AUTO_DISMISS_MS = 5000;
const IS_DEV = import.meta.env.DEV;

/** Matches global attachment max image default until portal loads limits from API per-request. */
const MAX_PHOTO_BYTES = FALLBACK_MAX_IMAGE_BYTES;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;
const MAX_VIDEO_DURATION_SECONDS = 10;
const MAX_UPLOAD_RETRY_ATTEMPTS = 3;
const RETRYABLE_UPLOAD_ERROR_CODES = new Set([
  'blob_upload_failed',
  'gateway_timeout',
  'upstream_timeout',
  'service_unavailable',
  'too_many_requests',
]);
const RETRYABLE_UPLOAD_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const PHOTO_MIME_PREFIXES = ['image/'];
const VIDEO_MIME_PREFIXES = ['video/'];

function detectMediaType(contentType) {
  const mime = (contentType || '').trim().toLowerCase();
  if (!mime) return null;
  if (PHOTO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'PHOTO';
  if (VIDEO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'VIDEO';
  return null;
}

function maxBytesForMediaType(mediaType) {
  if (mediaType === 'PHOTO') return MAX_PHOTO_BYTES;
  return MAX_VIDEO_BYTES;
}

function loadVideoDurationSeconds(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      URL.revokeObjectURL(objectUrl);
      if (Number.isFinite(duration) && duration >= 0) {
        resolve(duration);
      } else {
        reject(new Error('invalid_video_duration'));
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('invalid_video_duration'));
    };
    video.src = objectUrl;
  });
}

function extractErrorMessage(error, t, fallbackKey) {
  return t(fallbackKey);
}

function logAttachmentUploadFailure(error, context) {
  const errorDetails = error && typeof error === 'object' ? error.details : undefined;
  const rawError = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error;
  // Keep logs structured and sanitized to diagnose blob/CORS/SAS issues.
  console.error('portal.requests.attachments.upload.failed', {
    ...context,
    status: error && typeof error === 'object' ? error.status : undefined,
    code: error && typeof error === 'object' ? error.code : undefined,
    message: error && typeof error === 'object' ? error.message : undefined,
    details: errorDetails,
    rawError,
  });
}

function createUploadDebugId() {
  if (!IS_DEV) return '';
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `UP-${timestamp}-${randomPart}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableUploadError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = String(error.code || '').trim().toLowerCase();
  const status = Number(error.status);
  return RETRYABLE_UPLOAD_ERROR_CODES.has(code) || RETRYABLE_UPLOAD_HTTP_STATUSES.has(status);
}

function formatDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function usePortalRequests({
  baseUrl,
  isAuthenticated,
  isGuest,
  isManagement,
  isAdmin,
  meStatus,
  account,
  getAccessToken,
  handleApiForbidden,
  t,
  initialSelectedRequestId = '',
  secureAttachmentDeepLink = null,
  /** When false, skip fetching the requests list (overlay detail modal on other portal pages). */
  listLoadEnabled = true,
  /** When false, URL `initialSelectedRequestId` does not load detail (list page uses global modal for detail). */
  syncDetailFromUrl = true,
  /** Preferred id for list reload selection when `syncDetailFromUrl` is false (e.g. URL `id` on requests page). */
  listSelectionHintId = '',
}) {
  const [requestsStatus, setRequestsStatus] = useState('idle');
  const [requestsError, setRequestsError] = useState('');
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const selectedRequestIdRef = useRef('');
  selectedRequestIdRef.current = selectedRequestId;
  /** Tracks prior URL request id so we only fetch on id changes (initial deep link is handled by `loadRequests`). */
  const prevUrlSelectedRequestIdRef = useRef(undefined);
  const [requestDetail, setRequestDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [detailError, setDetailError] = useState('');
  const [threadMessages, setThreadMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const [tenantForm, setTenantForm] = useState({
    category_code: '',
    priority_code: '',
    title: '',
    description: '',
  });
  const [tenantCreateStatus, setTenantCreateStatus] = useState('idle');
  const [tenantCreateError, setTenantCreateError] = useState('');
  const [createAttachmentFiles, setCreateAttachmentFiles] = useState([]);
  const [cancelStatus, setCancelStatus] = useState('idle');
  const [cancelError, setCancelError] = useState('');
  const [lookupStatus, setLookupStatus] = useState('idle');
  const [lookupError, setLookupError] = useState('');
  const [lookupContact, setLookupContact] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);
  const [tenantDefaults, setTenantDefaults] = useState(null);

  const [managementForm, setManagementForm] = useState({
    status_code: '',
    priority_code: '',
    assigned_vendor_id: '',
    scheduled_from: '',
    scheduled_to: '',
    vendor_contact_name: '',
    vendor_contact_phone: '',
    internal_notes: '',
  });
  const [managementUpdateStatus, setManagementUpdateStatus] = useState('idle');
  const [managementUpdateError, setManagementUpdateError] = useState('');

  const [messageForm, setMessageForm] = useState({ body: '', is_internal: false });
  const [messageStatus, setMessageStatus] = useState('idle');
  const [messageError, setMessageError] = useState('');
  const [messageDeleteStatus, setMessageDeleteStatus] = useState('idle');
  const [messageDeleteError, setMessageDeleteError] = useState('');

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentStatus, setAttachmentStatus] = useState('idle');
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0);
  const [attachmentErrorDebugId, setAttachmentErrorDebugId] = useState('');
  const [attachmentDeleteStatus, setAttachmentDeleteStatus] = useState('idle');
  const [attachmentDeleteError, setAttachmentDeleteError] = useState('');
  const [attachmentShareStatus, setAttachmentShareStatus] = useState('idle');
  const [attachmentShareError, setAttachmentShareError] = useState('');
  const [attachmentRetryHint, setAttachmentRetryHint] = useState('');
  const secureLinkConsumedRef = useRef('');
  const elsaSummarizeSerialRef = useRef(0);

  const [exportStatus, setExportStatus] = useState('idle');
  const [exportError, setExportError] = useState('');
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditStatus, setAuditStatus] = useState('idle');
  const [auditError, setAuditError] = useState('');
  const [elsaSettings, setElsaSettings] = useState(null);
  const [elsaSettingsStatus, setElsaSettingsStatus] = useState('idle');
  const [elsaSettingsError, setElsaSettingsError] = useState('');
  const [elsaDecisionStatus, setElsaDecisionStatus] = useState('idle');
  const [elsaDecisionError, setElsaDecisionError] = useState('');
  const [elsaDecisions, setElsaDecisions] = useState([]);
  const [elsaDecisionActionStatus, setElsaDecisionActionStatus] = useState('idle');
  const [elsaAutoRespondEnabled, setElsaAutoRespondEnabled] = useState(false);
  const [elsaSummarizeStatus, setElsaSummarizeStatus] = useState('idle');
  const [elsaSummarizeError, setElsaSummarizeError] = useState('');
  const [elsaSummarizeText, setElsaSummarizeText] = useState('');
  const [elsaSummarizeProviderUsed, setElsaSummarizeProviderUsed] = useState('');
  const [managementStatusOptions] = useState(() => [
    RequestStatus.NOT_STARTED,
    RequestStatus.ACKNOWLEDGED,
    RequestStatus.SCHEDULED,
    RequestStatus.WAITING_ON_TENANT,
    RequestStatus.WAITING_ON_VENDOR,
    RequestStatus.COMPLETE,
    RequestStatus.CANCELLED,
  ]);

  const loadAuditForRequest = async (requestId) => {
    if (!requestId || !baseUrl || !isManagement) {
      setAuditEvents([]);
      setAuditStatus('idle');
      setAuditError('');
      return;
    }
    setAuditStatus('loading');
    setAuditError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchRequestAudit(baseUrl, token, { requestId, emailHint });
      setAuditEvents(Array.isArray(payload?.audits) ? payload.audits : []);
      setAuditStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setAuditStatus('error');
      setAuditError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
    }
  };

  const loadElsaContext = async (requestId) => {
    if (!requestId || !baseUrl || !isManagement) {
      setElsaDecisions([]);
      setElsaDecisionStatus('idle');
      setElsaDecisionError('');
      return;
    }
    setElsaDecisionStatus('loading');
    setElsaDecisionError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const [settingsPayload, decisionsPayload] = await Promise.all([
        fetchElsaSettings(baseUrl, token, { emailHint, requestId }),
        fetchElsaDecisions(baseUrl, token, requestId, { emailHint }),
      ]);
      const decisions = Array.isArray(decisionsPayload?.decisions) ? decisionsPayload.decisions : [];
      setElsaSettings(settingsPayload?.settings ?? null);
      setElsaAutoRespondEnabled(Boolean(settingsPayload?.request?.auto_respond_enabled ?? false));
      setElsaDecisions(decisions);
      setElsaDecisionStatus('ok');
      setElsaSettingsStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setElsaDecisionStatus('error');
      setElsaDecisionError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
    }
  };

  const listPath = useMemo(() => {
    if (!baseUrl) return '';
    return isManagement ? '/api/landlord/requests' : '/api/portal/requests';
  }, [baseUrl, isManagement]);

  const loadRequestDetails = async (requestId, options = {}) => {
    const { showLoadingState = true } = options;
    if (!requestId || !baseUrl) return;
    if (showLoadingState) {
      setDetailStatus('loading');
    }
    setDetailError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);

      const detailPath = isManagement
        ? `/api/landlord/requests/${encodeURIComponent(requestId)}`
        : `/api/portal/requests/${encodeURIComponent(requestId)}`;
      const messagesPath = `/api/portal/requests/${encodeURIComponent(requestId)}/messages`;
      const attachmentsPath = `/api/portal/requests/${encodeURIComponent(requestId)}/attachments`;

      const { detail, messagesPayload, attachmentsPayload } = await fetchRequestDetail(
        baseUrl,
        token,
        { detailPath, messagesPath, attachmentsPath, emailHint }
      );

      setRequestDetail(detail);
      setThreadMessages(Array.isArray(messagesPayload?.messages) ? messagesPayload.messages : []);
      setAttachments(Array.isArray(attachmentsPayload?.attachments) ? attachmentsPayload.attachments : []);
      setManagementForm((prev) => ({
        ...prev,
        status_code: detail?.status_code ?? '',
        priority_code: detail?.priority_code ?? '',
        assigned_vendor_id: detail?.assigned_vendor_id ?? '',
        scheduled_from: formatDateTimeLocalValue(detail?.scheduled_from || detail?.scheduled_for),
        scheduled_to: formatDateTimeLocalValue(detail?.scheduled_to),
        vendor_contact_name: detail?.vendor_contact_name ?? '',
        vendor_contact_phone: detail?.vendor_contact_phone ?? '',
        internal_notes: detail?.internal_notes ?? '',
      }));
      setDetailStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setDetailStatus('error');
      setDetailError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
      throw error;
    }
  };

  const loadRequests = async (opts = {}) => {
    const {
      keepSelection = true,
      showLoadingState = true,
      showDetailLoadingState = true,
    } = opts;
    if (!listLoadEnabled) return;
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    if (!listPath) return;
    if (showLoadingState) {
      setRequestsStatus('loading');
    }
    setRequestsError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchRequests(baseUrl, token, { path: listPath, emailHint });
      const nextRequests = Array.isArray(payload?.requests) ? payload.requests : [];
      setRequests(nextRequests);
      setRequestsStatus('ok');

      const currentSelected = selectedRequestIdRef.current;
      const pickId = String(listSelectionHintId || '').trim() || String(initialSelectedRequestId || '').trim();
      const requestIds = new Set(nextRequests.map((request) => request.id));
      const nextSelected = keepSelection
        ? (requestIds.has(currentSelected)
            ? currentSelected
            : requestIds.has(pickId)
              ? pickId
              : '')
        : nextRequests[0]?.id || '';
      setSelectedRequestId(nextSelected);
      if (nextSelected) {
        try {
          await loadRequestDetails(nextSelected, { showLoadingState: showDetailLoadingState });
          await loadAuditForRequest(nextSelected);
          await loadElsaContext(nextSelected);
        } catch (error) {
          handleApiForbidden(error);
          setDetailStatus('error');
          setDetailError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
        }
      } else {
        setRequestDetail(null);
        setDetailStatus('idle');
        setDetailError('');
        setThreadMessages([]);
        setAttachments([]);
        setAuditEvents([]);
        setAuditStatus('idle');
        setAuditError('');
        setElsaDecisions([]);
        setElsaDecisionStatus('idle');
        setElsaDecisionError('');
      }
    } catch (error) {
      handleApiForbidden(error);
      setRequestsStatus('error');
      setRequestsError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
    }
  };

  useEffect(() => {
    if (!listLoadEnabled) return;
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    loadRequests({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, isAuthenticated, isGuest, meStatus, listPath, listLoadEnabled]);

  useEffect(() => {
    if (!syncDetailFromUrl) return;
    const id = String(initialSelectedRequestId || '').trim();
    if (!id) {
      setSelectedRequestId('');
      return;
    }
    setSelectedRequestId(id);
  }, [syncDetailFromUrl, initialSelectedRequestId]);

  // After initial mount, load detail when the URL ?id= changes (loadRequests handles the first deep link).
  useEffect(() => {
    if (!syncDetailFromUrl) return;
    const id = String(initialSelectedRequestId || '').trim();
    const prev = prevUrlSelectedRequestIdRef.current;
    prevUrlSelectedRequestIdRef.current = id;

    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    if (requestsStatus !== 'ok') return;
    if (!id) return;
    if (!requests.some((r) => String(r.id) === id)) return;
    if (prev === undefined) return;
    if (prev === id) return;

    let cancelled = false;
    void (async () => {
      try {
        await loadRequestDetails(id);
        if (cancelled) return;
        await loadAuditForRequest(id);
        if (cancelled) return;
        await loadElsaContext(id);
      } catch {
        // surfaced via detailStatus / detailError
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL id + list readiness; skip first paint (loadRequests owns)
  }, [syncDetailFromUrl, initialSelectedRequestId, requestsStatus, requests]);

  // Overlay modal: load detail without a requests list (any portal route).
  useEffect(() => {
    if (listLoadEnabled) return;
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    const id = String(initialSelectedRequestId || '').trim();
    if (!id) {
      setSelectedRequestId('');
      setRequestDetail(null);
      setDetailStatus('idle');
      setDetailError('');
      setThreadMessages([]);
      setAttachments([]);
      setAuditEvents([]);
      setAuditStatus('idle');
      setAuditError('');
      setElsaDecisions([]);
      setElsaDecisionStatus('idle');
      setElsaDecisionError('');
      setElsaSummarizeStatus('idle');
      setElsaSummarizeError('');
      setElsaSummarizeText('');
      setElsaSummarizeProviderUsed('');
      return;
    }
    setSelectedRequestId(id);
    let cancelled = false;
    void (async () => {
      try {
        await loadRequestDetails(id);
        if (cancelled) return;
        await loadAuditForRequest(id);
        if (cancelled) return;
        await loadElsaContext(id);
      } catch {
        // surfaced via detailStatus / detailError
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlay id trigger; loaders use latest impl.
  }, [listLoadEnabled, initialSelectedRequestId, baseUrl, isAuthenticated, isGuest, meStatus]);

  useEffect(() => {
    const link = secureAttachmentDeepLink;
    const rid = String(initialSelectedRequestId || selectedRequestId || '').trim();
    if (!link?.attachmentId || !link?.accessToken || !rid) return;
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    if (detailStatus !== 'ok' || !requestDetail || String(requestDetail.id) !== rid) return;

    const key = `${rid}:${link.attachmentId}:${link.accessToken}`;
    if (secureLinkConsumedRef.current === key) return;
    secureLinkConsumedRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        const blob = await fetchRequestAttachmentFileWithToken(
          baseUrl,
          token,
          rid,
          link.attachmentId,
          link.accessToken,
          { emailHint }
        );
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      } catch (error) {
        if (cancelled) return;
        handleApiForbidden(error);
        setAttachmentShareError(t('portalRequests.attachments.deepLinkOpenFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    secureAttachmentDeepLink,
    baseUrl,
    isAuthenticated,
    isGuest,
    meStatus,
    detailStatus,
    requestDetail,
    initialSelectedRequestId,
    selectedRequestId,
    getAccessToken,
    account,
    handleApiForbidden,
    t,
  ]);

  useEffect(() => {
    if (!selectedRequestId) return;
    setCancelStatus('idle');
    setCancelError('');
    setManagementUpdateStatus('idle');
    setManagementUpdateError('');
    setMessageStatus('idle');
    setMessageError('');
    setMessageDeleteStatus('idle');
    setMessageDeleteError('');
    setAttachmentStatus('idle');
    setAttachmentError('');
    setAttachmentUploadProgress(0);
    setAttachmentFile(null);
    setAttachmentDeleteStatus('idle');
    setAttachmentDeleteError('');
    setAttachmentShareStatus('idle');
    setAttachmentShareError('');
    setAttachmentRetryHint('');
    setAttachmentErrorDebugId('');
    setMessageForm({ body: '', is_internal: false });
    setElsaDecisionStatus('idle');
    setElsaDecisionError('');
    setElsaDecisions([]);
    setElsaDecisionActionStatus('idle');
    setElsaSummarizeStatus('idle');
    setElsaSummarizeError('');
    setElsaSummarizeText('');
    setElsaSummarizeProviderUsed('');
  }, [selectedRequestId]);

  useEffect(() => {
    if (messageStatus !== 'success') return undefined;
    const timeoutId = window.setTimeout(() => {
      setMessageStatus('idle');
    }, MESSAGE_SUCCESS_AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [messageStatus]);

  useEffect(() => {
    if (messageDeleteStatus !== 'success') return undefined;
    const timeoutId = window.setTimeout(() => {
      setMessageDeleteStatus('idle');
    }, MESSAGE_SUCCESS_AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [messageDeleteStatus]);

  useEffect(() => {
    if (elsaDecisionActionStatus !== 'success') return undefined;
    const timeoutId = window.setTimeout(() => {
      setElsaDecisionActionStatus('idle');
    }, ELSA_DECISION_ACTION_SUCCESS_AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [elsaDecisionActionStatus]);

  useEffect(() => {
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') {
      setLookupStatus('idle');
      setLookupError('');
      setLookupContact(null);
      setCategoryOptions([]);
      setPriorityOptions([]);
      setTenantDefaults(null);
      return;
    }

    let cancelled = false;
    const loadLookups = async () => {
      setLookupStatus('loading');
      setLookupError('');
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        const payload = await fetchRequestLookups(baseUrl, token, { emailHint });
        if (cancelled) return;
        const categories = Array.isArray(payload?.categories) ? payload.categories : [];
        const priorities = Array.isArray(payload?.priorities) ? payload.priorities : [];
        const landlordContact = payload?.landlord_contact
          && typeof payload.landlord_contact === 'object'
          && typeof payload.landlord_contact.email === 'string'
          ? payload.landlord_contact
          : null;
        const defaults = payload?.tenant_defaults
          && typeof payload.tenant_defaults === 'object'
          && typeof payload.tenant_defaults.property_id === 'string'
          && typeof payload.tenant_defaults.lease_id === 'string'
          ? payload.tenant_defaults
          : null;
        if (!isManagement && !defaults) {
          const landlordName = [
            String(landlordContact?.first_name ?? '').trim(),
            String(landlordContact?.last_name ?? '').trim(),
          ].filter(Boolean).join(' ');
          setLookupStatus('error');
          setLookupError(t('portalRequests.errors.noTenantLeaseAccess'));
          setLookupContact(
            landlordContact?.email
              ? {
                  name: landlordName || t('portalRequests.errors.landlordFallbackName'),
                  email: landlordContact.email,
                }
              : null
          );
          setCategoryOptions([]);
          setPriorityOptions([]);
          setTenantDefaults(null);
          return;
        }
        setLookupContact(null);
        setCategoryOptions(categories);
        setPriorityOptions(priorities);
        setTenantDefaults(defaults ?? null);
        setLookupStatus('ok');
      } catch (error) {
        if (cancelled) return;
        handleApiForbidden(error);
        setLookupStatus('error');
        setLookupContact(null);
        setLookupError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
      }
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, account, getAccessToken, handleApiForbidden, isAuthenticated, isGuest, isManagement, meStatus, t]);

  useEffect(() => {
    if (lookupStatus !== 'ok') return;
    const firstCategoryCode = categoryOptions[0]?.code ?? '';
    const firstPriorityCode = priorityOptions[0]?.code ?? '';
    setTenantForm((prev) => ({
      ...prev,
      category_code:
        prev.category_code && categoryOptions.some((option) => option.code === prev.category_code)
          ? prev.category_code
          : firstCategoryCode,
      priority_code:
        prev.priority_code && priorityOptions.some((option) => option.code === prev.priority_code)
          ? prev.priority_code
          : firstPriorityCode,
    }));
  }, [categoryOptions, lookupStatus, priorityOptions]);

  useEffect(() => {
    if (!selectedRequestId || !baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return undefined;

    let cancelled = false;
    let refreshInFlight = false;

    const refreshMessages = async () => {
      if (cancelled || refreshInFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshInFlight = true;
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        const emailHint = emailFromAccount(account);
        const payload = await fetchRequestMessages(baseUrl, token, selectedRequestId, { emailHint });
        if (cancelled) return;
        const next = Array.isArray(payload?.messages) ? payload.messages : [];
        setThreadMessages((prev) => mergePolledRequestMessages(prev, next));
      } catch (error) {
        if (!cancelled) {
          handleApiForbidden(error);
        }
      } finally {
        refreshInFlight = false;
      }
    };

    const intervalId = window.setInterval(refreshMessages, MESSAGES_POLL_INTERVAL_MS);

    const refreshOnResume = () => {
      void refreshMessages();
    };
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshOnResume();
      }
    };
    window.addEventListener('focus', refreshOnResume);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnResume);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    selectedRequestId,
    baseUrl,
    isAuthenticated,
    isGuest,
    meStatus,
    getAccessToken,
    account,
    handleApiForbidden,
  ]);

  const onTenantField = (field) => (event) => {
    const value = event.target.value;
    setTenantForm((prev) => ({ ...prev, [field]: value }));
    setTenantCreateStatus('idle');
    setTenantCreateError('');
  };

  const validateAttachmentCandidate = async (file, existingCount) => {
    if (!file) return { ok: false, errorKey: 'portalRequests.errors.unsupportedFileType' };
    if (existingCount >= MAX_ATTACHMENTS) {
      return { ok: false, errorKey: 'portalRequests.errors.attachmentLimitExceeded' };
    }
    const contentType = file.type || 'application/octet-stream';
    const mediaType = detectMediaType(contentType);
    if (!mediaType) return { ok: false, errorKey: 'portalRequests.errors.unsupportedFileType' };
    const maxBytes = maxBytesForMediaType(mediaType);
    if (file.size > maxBytes) {
      return {
        ok: false,
        errorMessage: t('portalRequests.errors.fileTooLarge', {
          maxMb: Math.round(maxBytes / (1024 * 1024)),
        }),
      };
    }
    if (mediaType === 'VIDEO') {
      try {
        const durationSeconds = await loadVideoDurationSeconds(file);
        if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
          return {
            ok: false,
            errorMessage: t('portalRequests.errors.videoTooLong', { maxSeconds: MAX_VIDEO_DURATION_SECONDS }),
          };
        }
      } catch {
        return { ok: false, errorKey: 'portalRequests.errors.videoMetadataFailed' };
      }
    }
    return { ok: true };
  };

  const onCreateAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    let nextFiles = [...createAttachmentFiles];
    let validationError = '';
    for (const file of files) {
      const validation = await validateAttachmentCandidate(file, nextFiles.length);
      if (validation.ok) {
        nextFiles = [...nextFiles, file];
      } else {
        validationError = `${file.name}: ${validation.errorMessage || t(validation.errorKey)}`;
      }
    }
    setCreateAttachmentFiles(nextFiles);
    if (validationError) {
      setTenantCreateStatus('error');
      setTenantCreateError(validationError);
    } else {
      setTenantCreateStatus('idle');
      setTenantCreateError('');
    }
  };

  const onRemoveCreateAttachment = (index) => {
    setCreateAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onCreateRequest = async (event) => {
    event.preventDefault();
    if (!baseUrl || !tenantDefaults) return;
    if (createAttachmentFiles.length > MAX_ATTACHMENTS) {
      setTenantCreateStatus('error');
      setTenantCreateError(t('portalRequests.errors.attachmentLimitExceeded'));
      return;
    }
    setTenantCreateStatus('saving');
    setTenantCreateError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const result = await createRequest(baseUrl, token, {
        emailHint,
        property_id: tenantDefaults.property_id,
        lease_id: tenantDefaults.lease_id,
        ...tenantForm,
        emergency_disclaimer_acknowledged: true,
      });
      const newRequestId = result?.request?.id;
      if (newRequestId && createAttachmentFiles.length > 0) {
        for (const file of createAttachmentFiles) {
          const contentType = file.type || 'application/octet-stream';
          const mediaType = detectMediaType(contentType);
          if (!mediaType) continue;
          let fileDurationSeconds = undefined;
          if (mediaType === 'VIDEO') {
            try {
              fileDurationSeconds = await loadVideoDurationSeconds(file);
            } catch {
              fileDurationSeconds = undefined;
            }
          }
          try {
            const intentPayload = await requestUploadIntent(baseUrl, token, newRequestId, {
              emailHint,
              filename: file.name,
              content_type: contentType,
              file_size_bytes: file.size,
              file_duration_seconds: fileDurationSeconds,
            });
            const storagePath = intentPayload?.upload?.storage_path;
            const uploadUrl = intentPayload?.upload?.upload_url;
            if (!storagePath || !uploadUrl) continue;
            await putBlobToStorage(uploadUrl, file);
            await finalizeUpload(baseUrl, token, newRequestId, {
              emailHint,
              storage_path: storagePath,
              filename: file.name,
              content_type: contentType,
              file_size_bytes: file.size,
              file_duration_seconds: fileDurationSeconds,
            });
          } catch {
            // attachment upload failures are non-fatal; request was already created
          }
        }
      }
      setTenantCreateStatus('success');
      setTenantForm((prev) => ({ ...prev, title: '', description: '' }));
      setCreateAttachmentFiles([]);
      await loadRequests({ keepSelection: false, showLoadingState: false, showDetailLoadingState: false });
    } catch (error) {
      handleApiForbidden(error);
      setTenantCreateStatus('error');
      setTenantCreateError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onCancelRequest = async () => {
    if (!baseUrl || !selectedRequestId) return;
    setCancelStatus('saving');
    setCancelError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await cancelRequest(baseUrl, token, selectedRequestId, { emailHint });
      if (listLoadEnabled) {
        await loadRequests({ keepSelection: true, showLoadingState: false, showDetailLoadingState: false });
      } else {
        await loadRequestDetails(selectedRequestId, { showLoadingState: false });
        await loadAuditForRequest(selectedRequestId);
        await loadElsaContext(selectedRequestId);
      }
      setCancelStatus('success');
    } catch (error) {
      handleApiForbidden(error);
      setCancelStatus('error');
      setCancelError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onManagementField = (field) => (event) => {
    const value = event.target.value;
    setManagementForm((prev) => ({ ...prev, [field]: value }));
    setManagementUpdateStatus('idle');
    setManagementUpdateError('');
  };

  const onUpdateRequest = async (event) => {
    event.preventDefault();
    if (!baseUrl || !selectedRequestId) return;
    setManagementUpdateStatus('saving');
    setManagementUpdateError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const body = {};
      if (managementForm.status_code.trim()) {
        body.status_code = managementForm.status_code.trim().toUpperCase();
      }
      if (managementForm.priority_code.trim()) {
        body.priority_code = managementForm.priority_code.trim();
      }
      const scheduledFromDate = managementForm.scheduled_from.trim()
        ? new Date(managementForm.scheduled_from)
        : null;
      const scheduledToDate = managementForm.scheduled_to.trim()
        ? new Date(managementForm.scheduled_to)
        : null;
      body.assigned_vendor_id = managementForm.assigned_vendor_id.trim() || null;
      body.scheduled_for = scheduledFromDate && !Number.isNaN(scheduledFromDate.getTime())
        ? scheduledFromDate.toISOString()
        : null;
      body.scheduled_from = scheduledFromDate && !Number.isNaN(scheduledFromDate.getTime())
        ? scheduledFromDate.toISOString()
        : null;
      body.scheduled_to = scheduledToDate && !Number.isNaN(scheduledToDate.getTime())
        ? scheduledToDate.toISOString()
        : null;
      body.vendor_contact_name = managementForm.vendor_contact_name.trim() || null;
      body.vendor_contact_phone = managementForm.vendor_contact_phone.trim() || null;
      body.internal_notes = managementForm.internal_notes.trim() || null;
      await patchResource(
        baseUrl,
        token,
        `/api/landlord/requests/${encodeURIComponent(selectedRequestId)}`,
        { emailHint, ...body }
      );
      if (listLoadEnabled) {
        await loadRequests({ keepSelection: true, showLoadingState: false, showDetailLoadingState: false });
      } else {
        await loadRequestDetails(selectedRequestId, { showLoadingState: false });
        await loadAuditForRequest(selectedRequestId);
        await loadElsaContext(selectedRequestId);
      }
      setManagementUpdateStatus('success');
    } catch (error) {
      handleApiForbidden(error);
      setManagementUpdateStatus('error');
      setManagementUpdateError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onMessageSubmit = async (event) => {
    event.preventDefault();
    if (!baseUrl || !selectedRequestId || !messageForm.body.trim()) return;
    setMessageStatus('saving');
    setMessageError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await postMessage(baseUrl, token, selectedRequestId, {
        emailHint,
        body: messageForm.body.trim(),
        is_internal: isManagement ? Boolean(messageForm.is_internal) : false,
      });
      setMessageForm({ body: '', is_internal: false });
      await loadRequestDetails(selectedRequestId, { showLoadingState: false });
      setMessageStatus('success');
    } catch (error) {
      handleApiForbidden(error);
      setMessageStatus('error');
      setMessageError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onDeleteMessage = async (messageId) => {
    if (!baseUrl || !selectedRequestId || !messageId || !isAdmin) return;
    setMessageDeleteStatus('saving');
    setMessageDeleteError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await deleteRequestMessage(baseUrl, token, selectedRequestId, messageId, { emailHint });
      await loadRequestDetails(selectedRequestId, { showLoadingState: false });
      setMessageDeleteStatus('success');
    } catch (error) {
      handleApiForbidden(error);
      setMessageDeleteStatus('error');
      if (error && typeof error === 'object' && error.code === 'message_protected') {
        setMessageDeleteError(t('portalRequests.errors.messageProtected'));
      } else {
        setMessageDeleteError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
      }
    }
  };

  const onAttachmentChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setAttachmentFile(file);
    setAttachmentStatus('idle');
    setAttachmentError('');
    setAttachmentErrorDebugId('');
    setAttachmentUploadProgress(0);
    setAttachmentRetryHint('');
  };

  const onClearAttachmentFile = () => {
    setAttachmentFile(null);
    setAttachmentStatus('idle');
    setAttachmentError('');
    setAttachmentErrorDebugId('');
    setAttachmentUploadProgress(0);
    setAttachmentRetryHint('');
  };

  const uploadAttachmentWithRetry = async ({
    requestId,
    token,
    emailHint,
    file,
    contentType,
    fileDurationSeconds,
    onAttemptStart,
  }) => {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_UPLOAD_RETRY_ATTEMPTS; attempt += 1) {
      if (onAttemptStart) {
        onAttemptStart({ attempt, maxAttempts: MAX_UPLOAD_RETRY_ATTEMPTS, shouldRetry: attempt > 1 });
      }
      try {
        const intentPayload = await requestUploadIntent(baseUrl, token, requestId, {
          emailHint,
          filename: file.name,
          content_type: contentType,
          file_size_bytes: file.size,
          file_duration_seconds: fileDurationSeconds,
        });
        const storagePath = intentPayload?.upload?.storage_path;
        const uploadUrl = intentPayload?.upload?.upload_url;
        if (!storagePath || !uploadUrl) {
          const missingPathError = new Error(t('portalRequests.errors.uploadIntentMissingPath'));
          missingPathError.code = 'upload_intent_missing_path';
          throw missingPathError;
        }
        await putBlobToStorage(uploadUrl, file, (progress) => {
          setAttachmentUploadProgress(progress);
        });
        await finalizeUpload(baseUrl, token, requestId, {
          emailHint,
          storage_path: storagePath,
          filename: file.name,
          content_type: contentType,
          file_size_bytes: file.size,
          file_duration_seconds: fileDurationSeconds,
        });
        return { attemptsUsed: attempt };
      } catch (error) {
        lastError = error;
        const canRetry = attempt < MAX_UPLOAD_RETRY_ATTEMPTS && isRetryableUploadError(error);
        if (!canRetry) break;
        await sleep(300 * attempt);
      }
    }
    throw lastError;
  };

  const onAttachmentSubmit = async (event) => {
    event.preventDefault();
    if (!baseUrl || !selectedRequestId || !attachmentFile) return;
    const validation = await validateAttachmentCandidate(attachmentFile, attachments.length);
    if (!validation.ok) {
      setAttachmentStatus('error');
      setAttachmentError(validation.errorMessage || t(validation.errorKey));
      return;
    }
    const contentType = attachmentFile.type || 'application/octet-stream';
    const mediaType = detectMediaType(contentType);
    let fileDurationSeconds = undefined;
    if (mediaType === 'VIDEO') {
      try {
        fileDurationSeconds = await loadVideoDurationSeconds(attachmentFile);
      } catch {
        fileDurationSeconds = undefined;
      }
    }

    setAttachmentStatus('saving');
    setAttachmentError('');
    setAttachmentErrorDebugId('');
    setAttachmentUploadProgress(0);
    setAttachmentRetryHint('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const uploadResult = await uploadAttachmentWithRetry({
        requestId: selectedRequestId,
        token,
        emailHint,
        file: attachmentFile,
        contentType,
        fileDurationSeconds,
        onAttemptStart: ({ attempt, shouldRetry, maxAttempts }) => {
          if (!shouldRetry) {
            setAttachmentRetryHint('');
            return;
          }
          setAttachmentUploadProgress(0);
          setAttachmentRetryHint(t('portalRequests.attachments.retryingHint', { attempt, maxAttempts }));
        },
      });
      setAttachmentFile(null);
      setAttachmentUploadProgress(100);
      setAttachmentErrorDebugId('');
      setAttachmentRetryHint(
        uploadResult.attemptsUsed > 1
          ? t('portalRequests.attachments.retryRecoveredHint', { attempts: uploadResult.attemptsUsed })
          : ''
      );
      await loadRequestDetails(selectedRequestId, { showLoadingState: false });
      setAttachmentStatus('success');
    } catch (error) {
      const debugId = createUploadDebugId();
      handleApiForbidden(error);
      setAttachmentStatus('error');
      setAttachmentErrorDebugId(debugId);
      setAttachmentRetryHint('');
      logAttachmentUploadFailure(error, {
        requestId: selectedRequestId,
        fileName: attachmentFile?.name,
        fileSizeBytes: attachmentFile?.size,
        contentType,
        stage: 'request_detail_upload',
        debugId,
      });
      if (error && typeof error === 'object' && error.status === 422 && error.code === 'storage_not_configured') {
        setAttachmentError(t('portalRequests.errors.attachmentStorageUnavailable'));
      } else if (error && typeof error === 'object' && error.code === 'upload_intent_missing_path') {
        setAttachmentError(t('portalRequests.errors.uploadIntentMissingPath'));
      } else if (error && typeof error === 'object' && error.code === 'blob_upload_failed') {
        setAttachmentError(t('portalRequests.errors.attachmentUploadFailed'));
      } else {
        setAttachmentError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
      }
    }
  };

  const onDeleteAttachment = async (attachmentId) => {
    if (!baseUrl || !selectedRequestId || !attachmentId) return;
    setAttachmentDeleteStatus('saving');
    setAttachmentDeleteError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await deleteRequestAttachment(baseUrl, token, selectedRequestId, attachmentId, { emailHint });
      await loadRequestDetails(selectedRequestId, { showLoadingState: false });
      setAttachmentDeleteStatus('success');
    } catch (error) {
      handleApiForbidden(error);
      setAttachmentDeleteStatus('error');
      setAttachmentDeleteError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onShareAttachment = async (attachmentId) => {
    if (!baseUrl || !selectedRequestId || !attachmentId || !isManagement) return null;
    setAttachmentShareStatus('saving');
    setAttachmentShareError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await createRequestAttachmentShareLink(
        baseUrl,
        token,
        selectedRequestId,
        attachmentId,
        { emailHint }
      );
      const portalPath = payload?.share?.portal_path;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const shareUrl =
        typeof portalPath === 'string' && portalPath.startsWith('http')
          ? portalPath
          : typeof portalPath === 'string' && portalPath.startsWith('/')
            ? `${origin}${portalPath}`
            : '';
      if (!shareUrl) {
        throw new Error('missing_share_url');
      }
      setAttachmentShareStatus('success');
      return {
        shareUrl,
        expiresAt: payload?.share?.expires_at || '',
      };
    } catch (error) {
      handleApiForbidden(error);
      setAttachmentShareStatus('error');
      setAttachmentShareError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
      return null;
    }
  };

  const onExportCsv = async () => {
    if (!baseUrl || !isManagement) return;
    setExportStatus('loading');
    setExportError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const blob = await fetchExportCsv(baseUrl, token, { emailHint });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'maintenance-requests.csv';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setExportStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setExportStatus('error');
      setExportError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
    }
  };

  const onSetElsaAutoRespond = async (enabled) => {
    if (!baseUrl || !selectedRequestId || !isManagement) return;
    setElsaDecisionStatus('loading');
    setElsaDecisionError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaRequestAutoRespond(baseUrl, token, selectedRequestId, {
        emailHint,
        auto_respond_enabled: Boolean(enabled),
      });
      setElsaAutoRespondEnabled(Boolean(enabled));
      await loadElsaContext(selectedRequestId);
    } catch (error) {
      handleApiForbidden(error);
      setElsaDecisionStatus('error');
      setElsaDecisionError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onRunElsa = async () => {
    if (!baseUrl || !selectedRequestId || !isManagement) return;
    setElsaDecisionStatus('loading');
    setElsaDecisionError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const result = await processElsaRequest(baseUrl, token, selectedRequestId, {
        emailHint,
        force_review: true,
      });
      await loadRequestDetails(selectedRequestId, { showLoadingState: false });
      await loadElsaContext(selectedRequestId);
      return result;
    } catch (error) {
      handleApiForbidden(error);
      setElsaDecisionStatus('error');
      setElsaDecisionError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
      return null;
    }
  };

  const onDismissElsaSummary = () => {
    elsaSummarizeSerialRef.current += 1;
    setElsaSummarizeStatus('idle');
    setElsaSummarizeError('');
    setElsaSummarizeText('');
    setElsaSummarizeProviderUsed('');
  };

  const onSummarizeElsaRequest = async () => {
    if (!baseUrl || !selectedRequestId || !isManagement) return;
    const serial = ++elsaSummarizeSerialRef.current;
    setElsaSummarizeStatus('loading');
    setElsaSummarizeError('');
    setElsaSummarizeText('');
    setElsaSummarizeProviderUsed('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await summarizeElsaRequest(baseUrl, token, selectedRequestId, { emailHint });
      if (serial !== elsaSummarizeSerialRef.current) return;
      const summary = typeof payload?.summary === 'string' ? payload.summary.trim() : '';
      const providerUsed = typeof payload?.provider_used === 'string' ? payload.provider_used : '';
      if (!summary) {
        setElsaSummarizeStatus('error');
        setElsaSummarizeError(t('portalRequests.elsa.summaryEmpty'));
        return;
      }
      setElsaSummarizeText(summary);
      setElsaSummarizeProviderUsed(providerUsed);
      setElsaSummarizeStatus('ok');
    } catch (error) {
      if (serial !== elsaSummarizeSerialRef.current) return;
      handleApiForbidden(error);
      setElsaSummarizeStatus('error');
      setElsaSummarizeError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onReviewElsaDecision = async (decisionId, action) => {
    if (!baseUrl || !selectedRequestId || !isManagement || !decisionId || !action) return;
    setElsaDecisionActionStatus('saving');
    setElsaDecisionError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaDecisionReview(baseUrl, token, selectedRequestId, decisionId, {
        emailHint,
        action,
      });
      await loadRequestDetails(selectedRequestId, { showLoadingState: false });
      await loadElsaContext(selectedRequestId);
      setElsaDecisionActionStatus('success');
    } catch (error) {
      handleApiForbidden(error);
      setElsaDecisionActionStatus('error');
      setElsaDecisionError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onUpdateElsaGlobalSettings = async (updates) => {
    if (!baseUrl || !isManagement) return;
    setElsaSettingsStatus('loading');
    setElsaSettingsError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaSettings(baseUrl, token, { emailHint, ...updates });
      const payload = await fetchElsaSettings(baseUrl, token, { emailHint });
      setElsaSettings(payload?.settings ?? null);
      setElsaSettingsStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setElsaSettingsStatus('error');
      setElsaSettingsError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onSetElsaCategoryEnabled = async (categoryCode, enabled) => {
    if (!baseUrl || !isManagement || !categoryCode) return;
    setElsaSettingsStatus('loading');
    setElsaSettingsError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaCategoryPolicy(baseUrl, token, categoryCode, {
        emailHint,
        auto_send_enabled: Boolean(enabled),
      });
      const payload = await fetchElsaSettings(baseUrl, token, { emailHint });
      setElsaSettings(payload?.settings ?? null);
      setElsaSettingsStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setElsaSettingsStatus('error');
      setElsaSettingsError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onSetElsaPriorityPolicy = async (priorityCode, autoSendEnabled, requireAdminReview) => {
    if (!baseUrl || !isManagement || !priorityCode) return;
    setElsaSettingsStatus('loading');
    setElsaSettingsError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaPriorityPolicy(baseUrl, token, priorityCode, {
        emailHint,
        auto_send_enabled: Boolean(autoSendEnabled),
        require_admin_review: Boolean(requireAdminReview),
      });
      const payload = await fetchElsaSettings(baseUrl, token, { emailHint });
      setElsaSettings(payload?.settings ?? null);
      setElsaSettingsStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setElsaSettingsStatus('error');
      setElsaSettingsError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  return {
    requestsStatus,
    requestsError,
    requests,
    selectedRequestId,
    setSelectedRequestId,
    requestDetail,
    detailStatus,
    detailError,
    threadMessages,
    attachments,
    tenantForm,
    tenantDefaults,
    lookupStatus,
    lookupError,
    lookupContact,
    categoryOptions,
    priorityOptions,
    tenantCreateStatus,
    tenantCreateError,
    createAttachmentFiles,
    cancelStatus,
    cancelError,
    managementForm,
    managementStatusOptions,
    managementUpdateStatus,
    managementUpdateError,
    messageForm,
    setMessageForm,
    messageStatus,
    messageError,
    messageDeleteStatus,
    messageDeleteError,
    attachmentFile,
    attachmentStatus,
    attachmentError,
    attachmentErrorDebugId,
    attachmentUploadProgress,
    attachmentDeleteStatus,
    attachmentDeleteError,
    attachmentRetryHint,
    attachmentShareStatus,
    attachmentShareError,
    exportStatus,
    exportError,
    auditEvents,
    auditStatus,
    auditError,
    elsaSettings,
    elsaSettingsStatus,
    elsaSettingsError,
    elsaDecisionStatus,
    elsaDecisionError,
    elsaDecisionActionStatus,
    elsaDecisions,
    elsaAutoRespondEnabled,
    elsaSummarizeStatus,
    elsaSummarizeError,
    elsaSummarizeText,
    elsaSummarizeProviderUsed,
    loadRequestDetails,
    loadAuditForRequest,
    loadElsaContext,
    loadRequests,
    onTenantField,
    onCreateAttachmentChange,
    onRemoveCreateAttachment,
    onCreateRequest,
    onCancelRequest,
    onManagementField,
    onUpdateRequest,
    onMessageSubmit,
    onDeleteMessage,
    onAttachmentChange,
    onClearAttachmentFile,
    onAttachmentSubmit,
    onDeleteAttachment,
    onShareAttachment,
    onExportCsv,
    onSetElsaAutoRespond,
    onRunElsa,
    onSummarizeElsaRequest,
    onDismissElsaSummary,
    onReviewElsaDecision,
    onUpdateElsaGlobalSettings,
    onSetElsaCategoryEnabled,
    onSetElsaPriorityPolicy,
  };
}

