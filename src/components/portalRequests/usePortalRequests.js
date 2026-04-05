import { useEffect, useMemo, useState } from 'react';
import { emailFromAccount } from '../../portalUtils';
import { endpoint, parseErrorResponse } from './api';

export function usePortalRequests({
  baseUrl,
  isAuthenticated,
  isGuest,
  isManagement,
  meStatus,
  account,
  getAccessToken,
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
    property_id: '',
    lease_id: '',
    category_code: 'GENERAL',
    priority_code: 'MEDIUM',
    title: '',
    description: '',
  });
  const [tenantCreateStatus, setTenantCreateStatus] = useState('idle');
  const [tenantCreateError, setTenantCreateError] = useState('');

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

  const headersBuilder = useMemo(
    () => async () => {
      const token = await getAccessToken();
      const hint = emailFromAccount(account);
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (hint) headers['X-Email-Hint'] = hint;
      return headers;
    },
    [account, getAccessToken]
  );

  const listUrl = useMemo(() => {
    if (!baseUrl) return '';
    if (isManagement) return endpoint(baseUrl, '/api/landlord/requests');
    return endpoint(baseUrl, '/api/portal/requests');
  }, [baseUrl, isManagement]);

  const loadRequestDetails = async (requestId) => {
    if (!requestId || !baseUrl) return;
    const headers = await headersBuilder();

    const detailPath = isManagement
      ? `/api/landlord/requests/${encodeURIComponent(requestId)}`
      : `/api/portal/requests/${encodeURIComponent(requestId)}`;
    const messagesPath = `/api/portal/requests/${encodeURIComponent(requestId)}/messages`;
    const attachmentsPath = `/api/portal/requests/${encodeURIComponent(requestId)}/attachments`;

    const detailRes = await fetch(endpoint(baseUrl, detailPath), {
      method: 'GET',
      headers,
      credentials: 'omit',
    });
    if (!detailRes.ok) throw new Error(await parseErrorResponse(detailRes));
    const detailPayload = await detailRes.json();
    const detail = detailPayload?.request ?? null;

    const messagesRes = await fetch(endpoint(baseUrl, messagesPath), {
      method: 'GET',
      headers,
      credentials: 'omit',
    });
    if (!messagesRes.ok) throw new Error(await parseErrorResponse(messagesRes));
    const messagesPayload = await messagesRes.json();

    const attachmentsRes = await fetch(endpoint(baseUrl, attachmentsPath), {
      method: 'GET',
      headers,
      credentials: 'omit',
    });
    if (!attachmentsRes.ok) throw new Error(await parseErrorResponse(attachmentsRes));
    const attachmentsPayload = await attachmentsRes.json();

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
    if (!listUrl) return;
    setRequestsStatus('loading');
    setRequestsError('');
    try {
      const headers = await headersBuilder();
      const res = await fetch(listUrl, {
        method: 'GET',
        headers,
        credentials: 'omit',
      });
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      const payload = await res.json();
      const nextRequests = Array.isArray(payload?.requests) ? payload.requests : [];
      setRequests(nextRequests);
      setRequestsStatus('ok');

      const nextSelected = opts.keepSelection
        ? selectedRequestId || nextRequests[0]?.id || ''
        : nextRequests[0]?.id || '';
      setSelectedRequestId(nextSelected);
      if (nextSelected) {
        await loadRequestDetails(nextSelected);
      } else {
        setRequestDetail(null);
        setThreadMessages([]);
        setAttachments([]);
      }
    } catch (error) {
      setRequestsStatus('error');
      setRequestsError(error instanceof Error ? error.message : t('portalRequests.errors.loadFailed'));
    }
  };

  useEffect(() => {
    if (!baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    loadRequests({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, isAuthenticated, isGuest, meStatus, listUrl]);

  const onTenantField = (field) => (event) => {
    const value = event.target.value;
    setTenantForm((prev) => ({ ...prev, [field]: value }));
    setTenantCreateStatus('idle');
    setTenantCreateError('');
  };

  const onCreateRequest = async (event) => {
    event.preventDefault();
    if (!baseUrl) return;
    setTenantCreateStatus('saving');
    setTenantCreateError('');
    try {
      const headers = await headersBuilder();
      const res = await fetch(endpoint(baseUrl, '/api/portal/requests'), {
        method: 'POST',
        headers,
        credentials: 'omit',
        body: JSON.stringify({
          ...tenantForm,
          emergency_disclaimer_acknowledged: true,
        }),
      });
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      setTenantCreateStatus('success');
      setTenantForm((prev) => ({ ...prev, title: '', description: '' }));
      await loadRequests({ keepSelection: false });
    } catch (error) {
      setTenantCreateStatus('error');
      setTenantCreateError(error instanceof Error ? error.message : t('portalRequests.errors.saveFailed'));
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
      const headers = await headersBuilder();
      const body = {};
      if (managementForm.status_code.trim()) body.status_code = managementForm.status_code.trim();
      body.assigned_vendor_id = managementForm.assigned_vendor_id.trim() || null;
      body.internal_notes = managementForm.internal_notes.trim() || null;
      const res = await fetch(
        endpoint(baseUrl, `/api/landlord/requests/${encodeURIComponent(selectedRequestId)}`),
        {
          method: 'PATCH',
          headers,
          credentials: 'omit',
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      setManagementUpdateStatus('success');
      await loadRequests({ keepSelection: true });
    } catch (error) {
      setManagementUpdateStatus('error');
      setManagementUpdateError(error instanceof Error ? error.message : t('portalRequests.errors.saveFailed'));
    }
  };

  const onMessageSubmit = async (event) => {
    event.preventDefault();
    if (!baseUrl || !selectedRequestId || !messageForm.body.trim()) return;
    setMessageStatus('saving');
    setMessageError('');
    try {
      const headers = await headersBuilder();
      const res = await fetch(
        endpoint(baseUrl, `/api/portal/requests/${encodeURIComponent(selectedRequestId)}/messages`),
        {
          method: 'POST',
          headers,
          credentials: 'omit',
          body: JSON.stringify({
            body: messageForm.body.trim(),
            is_internal: isManagement ? Boolean(messageForm.is_internal) : false,
          }),
        }
      );
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      setMessageStatus('success');
      setMessageForm({ body: '', is_internal: false });
      await loadRequestDetails(selectedRequestId);
    } catch (error) {
      setMessageStatus('error');
      setMessageError(error instanceof Error ? error.message : t('portalRequests.errors.saveFailed'));
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
      const headers = await headersBuilder();
      const intentRes = await fetch(
        endpoint(baseUrl, `/api/portal/requests/${encodeURIComponent(selectedRequestId)}/uploads/intent`),
        {
          method: 'POST',
          headers,
          credentials: 'omit',
          body: JSON.stringify({
            filename: attachmentFile.name,
            content_type: attachmentFile.type || 'application/octet-stream',
            file_size_bytes: attachmentFile.size,
          }),
        }
      );
      if (!intentRes.ok) throw new Error(await parseErrorResponse(intentRes));
      const intentPayload = await intentRes.json();
      const storagePath = intentPayload?.upload?.storage_path;
      if (!storagePath) throw new Error(t('portalRequests.errors.uploadIntentMissingPath'));

      const finalizeRes = await fetch(
        endpoint(baseUrl, `/api/portal/requests/${encodeURIComponent(selectedRequestId)}/attachments`),
        {
          method: 'POST',
          headers,
          credentials: 'omit',
          body: JSON.stringify({
            storage_path: storagePath,
            filename: attachmentFile.name,
            content_type: attachmentFile.type || 'application/octet-stream',
            file_size_bytes: attachmentFile.size,
          }),
        }
      );
      if (!finalizeRes.ok) throw new Error(await parseErrorResponse(finalizeRes));
      setAttachmentStatus('success');
      setAttachmentFile(null);
      await loadRequestDetails(selectedRequestId);
    } catch (error) {
      setAttachmentStatus('error');
      setAttachmentError(error instanceof Error ? error.message : t('portalRequests.errors.saveFailed'));
    }
  };

  const onSuggestReply = async () => {
    if (!baseUrl || !selectedRequestId || !isManagement) return;
    setSuggestionStatus('loading');
    setSuggestionError('');
    setSuggestionText('');
    try {
      const headers = await headersBuilder();
      const res = await fetch(
        endpoint(baseUrl, `/api/landlord/requests/${encodeURIComponent(selectedRequestId)}/suggest-reply`),
        { method: 'POST', headers, credentials: 'omit' }
      );
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      const payload = await res.json();
      setSuggestionStatus('ok');
      setSuggestionText(typeof payload?.suggestion === 'string' ? payload.suggestion : '');
    } catch (error) {
      setSuggestionStatus('error');
      setSuggestionError(error instanceof Error ? error.message : t('portalRequests.errors.loadFailed'));
    }
  };

  const onExportCsv = async () => {
    if (!baseUrl || !isManagement) return;
    setExportStatus('loading');
    setExportError('');
    try {
      const token = await getAccessToken();
      const hint = emailFromAccount(account);
      const headers = { Accept: 'text/csv', Authorization: `Bearer ${token}` };
      if (hint) headers['X-Email-Hint'] = hint;
      const res = await fetch(endpoint(baseUrl, '/api/landlord/exports/requests.csv'), {
        method: 'GET',
        headers,
        credentials: 'omit',
      });
      if (!res.ok) throw new Error(await parseErrorResponse(res));
      const blob = await res.blob();
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
      setExportStatus('error');
      setExportError(error instanceof Error ? error.message : t('portalRequests.errors.loadFailed'));
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
    loadRequestDetails,
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

