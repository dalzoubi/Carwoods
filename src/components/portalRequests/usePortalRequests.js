import { useEffect, useMemo, useState } from 'react';
import { emailFromAccount } from '../../portalUtils';
import {
  fetchRequestDetail,
  fetchRequests,
  fetchRequestLookups,
  createRequest,
  postMessage,
  requestUploadIntent,
  finalizeUpload,
  patchResource,
  fetchSuggestReply,
  fetchExportCsv,
  fetchRequestAudit,
} from '../../lib/portalApiClient';

function extractErrorMessage(error, t, fallbackKey) {
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return t(fallbackKey);
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
}) {
  const [requestsStatus, setRequestsStatus] = useState('idle');
  const [requestsError, setRequestsError] = useState('');
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [requestDetail, setRequestDetail] = useState(null);
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
  const [lookupStatus, setLookupStatus] = useState('idle');
  const [lookupError, setLookupError] = useState('');
  const [lookupContact, setLookupContact] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);
  const [tenantDefaults, setTenantDefaults] = useState(null);

  const [managementForm, setManagementForm] = useState({
    status_code: '',
    assigned_vendor_id: '',
    internal_notes: '',
  });
  const [managementUpdateStatus, setManagementUpdateStatus] = useState('idle');
  const [managementUpdateError, setManagementUpdateError] = useState('');

  const [messageForm, setMessageForm] = useState({ body: '', is_internal: false });
  const [messageStatus, setMessageStatus] = useState('idle');
  const [messageError, setMessageError] = useState('');

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentStatus, setAttachmentStatus] = useState('idle');
  const [attachmentError, setAttachmentError] = useState('');

  const [suggestionStatus, setSuggestionStatus] = useState('idle');
  const [suggestionError, setSuggestionError] = useState('');
  const [suggestionText, setSuggestionText] = useState('');

  const [exportStatus, setExportStatus] = useState('idle');
  const [exportError, setExportError] = useState('');
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditStatus, setAuditStatus] = useState('idle');
  const [auditError, setAuditError] = useState('');

  const loadAuditForRequest = async (requestId) => {
    if (!requestId || !baseUrl || !isAdmin) {
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

  const listPath = useMemo(() => {
    if (!baseUrl) return '';
    return isManagement ? '/api/landlord/requests' : '/api/portal/requests';
  }, [baseUrl, isManagement]);

  const loadRequestDetails = async (requestId) => {
    if (!requestId || !baseUrl) return;
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
      internal_notes: detail?.internal_notes ?? '',
    }));
  };

  const loadRequests = async (opts = { keepSelection: true }) => {
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    if (!listPath) return;
    setRequestsStatus('loading');
    setRequestsError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchRequests(baseUrl, token, { path: listPath, emailHint });
      const nextRequests = Array.isArray(payload?.requests) ? payload.requests : [];
      setRequests(nextRequests);
      setRequestsStatus('ok');

      const nextSelected = opts.keepSelection
        ? selectedRequestId || nextRequests[0]?.id || ''
        : nextRequests[0]?.id || '';
      setSelectedRequestId(nextSelected);
      if (nextSelected) {
        await loadRequestDetails(nextSelected);
        await loadAuditForRequest(nextSelected);
      } else {
        setRequestDetail(null);
        setThreadMessages([]);
        setAttachments([]);
        setAuditEvents([]);
        setAuditStatus('idle');
        setAuditError('');
      }
    } catch (error) {
      handleApiForbidden(error);
      setRequestsStatus('error');
      setRequestsError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
    }
  };

  useEffect(() => {
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    loadRequests({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, isAuthenticated, isGuest, meStatus, listPath]);

  useEffect(() => {
    if (!baseUrl || !isAuthenticated || isGuest || isManagement || meStatus !== 'ok') {
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
        if (!defaults) {
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
        setTenantDefaults(defaults);
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

  const onTenantField = (field) => (event) => {
    const value = event.target.value;
    setTenantForm((prev) => ({ ...prev, [field]: value }));
    setTenantCreateStatus('idle');
    setTenantCreateError('');
  };

  const onCreateRequest = async (event) => {
    event.preventDefault();
    if (!baseUrl || !tenantDefaults) return;
    setTenantCreateStatus('saving');
    setTenantCreateError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await createRequest(baseUrl, token, {
        emailHint,
        property_id: tenantDefaults.property_id,
        lease_id: tenantDefaults.lease_id,
        ...tenantForm,
        emergency_disclaimer_acknowledged: true,
      });
      setTenantCreateStatus('success');
      setTenantForm((prev) => ({ ...prev, title: '', description: '' }));
      await loadRequests({ keepSelection: false });
    } catch (error) {
      handleApiForbidden(error);
      setTenantCreateStatus('error');
      setTenantCreateError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
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
      if (managementForm.status_code.trim()) body.status_code = managementForm.status_code.trim();
      body.assigned_vendor_id = managementForm.assigned_vendor_id.trim() || null;
      body.internal_notes = managementForm.internal_notes.trim() || null;
      await patchResource(
        baseUrl,
        token,
        `/api/landlord/requests/${encodeURIComponent(selectedRequestId)}`,
        { emailHint, ...body }
      );
      setManagementUpdateStatus('success');
      await loadRequests({ keepSelection: true });
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
      setMessageStatus('success');
      setMessageForm({ body: '', is_internal: false });
      await loadRequestDetails(selectedRequestId);
    } catch (error) {
      handleApiForbidden(error);
      setMessageStatus('error');
      setMessageError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onAttachmentChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setAttachmentFile(file);
    setAttachmentStatus('idle');
    setAttachmentError('');
  };

  const onAttachmentSubmit = async (event) => {
    event.preventDefault();
    if (!baseUrl || !selectedRequestId || !attachmentFile) return;
    setAttachmentStatus('saving');
    setAttachmentError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const filePayload = {
        emailHint,
        filename: attachmentFile.name,
        content_type: attachmentFile.type || 'application/octet-stream',
        file_size_bytes: attachmentFile.size,
      };
      const intentPayload = await requestUploadIntent(baseUrl, token, selectedRequestId, filePayload);
      const storagePath = intentPayload?.upload?.storage_path;
      if (!storagePath) throw new Error(t('portalRequests.errors.uploadIntentMissingPath'));

      await finalizeUpload(baseUrl, token, selectedRequestId, {
        emailHint,
        storage_path: storagePath,
        filename: attachmentFile.name,
        content_type: attachmentFile.type || 'application/octet-stream',
        file_size_bytes: attachmentFile.size,
      });
      setAttachmentStatus('success');
      setAttachmentFile(null);
      await loadRequestDetails(selectedRequestId);
    } catch (error) {
      handleApiForbidden(error);
      setAttachmentStatus('error');
      setAttachmentError(extractErrorMessage(error, t, 'portalRequests.errors.saveFailed'));
    }
  };

  const onSuggestReply = async () => {
    if (!baseUrl || !selectedRequestId || !isManagement) return;
    setSuggestionStatus('loading');
    setSuggestionError('');
    setSuggestionText('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchSuggestReply(baseUrl, token, selectedRequestId, { emailHint });
      setSuggestionStatus('ok');
      setSuggestionText(typeof payload?.suggestion === 'string' ? payload.suggestion : '');
    } catch (error) {
      handleApiForbidden(error);
      setSuggestionStatus('error');
      setSuggestionError(extractErrorMessage(error, t, 'portalRequests.errors.loadFailed'));
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

  return {
    requestsStatus,
    requestsError,
    requests,
    selectedRequestId,
    setSelectedRequestId,
    requestDetail,
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
    managementForm,
    managementUpdateStatus,
    managementUpdateError,
    messageForm,
    setMessageForm,
    messageStatus,
    messageError,
    attachmentFile,
    attachmentStatus,
    attachmentError,
    suggestionStatus,
    suggestionError,
    suggestionText,
    exportStatus,
    exportError,
    auditEvents,
    auditStatus,
    auditError,
    loadRequestDetails,
    loadAuditForRequest,
    loadRequests,
    onTenantField,
    onCreateRequest,
    onManagementField,
    onUpdateRequest,
    onMessageSubmit,
    onAttachmentChange,
    onAttachmentSubmit,
    onSuggestReply,
    onExportCsv,
  };
}

