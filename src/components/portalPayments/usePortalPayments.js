import { useCallback, useEffect, useState } from 'react';
import { isPortalApiReachable } from '../../featureFlags';
import { emailFromAccount } from '../../portalUtils';
import {
  fetchPaymentsApi,
  createLeasePaymentEntry,
  updateLeasePaymentEntry,
} from '../../lib/portalApiClient';

const EMPTY_FORM = {
  lease_id: '',
  period_start: '',
  amount_due: '',
  amount_paid: '',
  due_date: '',
  paid_date: '',
  payment_method: '',
  notes: '',
};

function extractError(error, t, fallbackKey) {
  const base = t(fallbackKey);
  const code = error && typeof error === 'object' ? error.code : '';
  if (typeof code === 'string' && code.trim()) {
    return `${base} (${code})`;
  }
  return base;
}

export function usePortalPayments({
  baseUrl,
  isAuthenticated,
  isGuest,
  isManagement,
  meStatus,
  account,
  getAccessToken,
  handleApiForbidden,
  t,
}) {
  const [entriesStatus, setEntriesStatus] = useState('idle');
  const [entriesError, setEntriesError] = useState('');
  const [entries, setEntries] = useState([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');

  const listPath = isManagement ? null : '/api/portal/payments';

  const loadEntries = useCallback(async (opts = {}) => {
    const { leaseId } = opts;
    if (!isPortalApiReachable(baseUrl) || !isAuthenticated || isGuest || meStatus !== 'ok') return;
    if (!isManagement && !listPath) return;
    if (isManagement && !leaseId) return;

    setEntriesStatus('loading');
    setEntriesError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const path = isManagement
        ? `/api/landlord/payments?lease_id=${encodeURIComponent(leaseId)}`
        : listPath;
      const data = await fetchPaymentsApi(baseUrl, token, { path, emailHint });
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setEntriesStatus('ok');
    } catch (error) {
      console.error('[Payments] loadEntries failed', {
        scope: isManagement ? 'landlord' : 'portal',
        leaseId: isManagement ? leaseId : undefined,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      handleApiForbidden(error);
      setEntriesStatus('error');
      setEntriesError(extractError(error, t, 'portalPayments.errors.loadFailed'));
    }
  }, [baseUrl, isAuthenticated, isGuest, isManagement, meStatus, getAccessToken, account, handleApiForbidden, t, listPath]);

  useEffect(() => {
    if (!isManagement) {
      loadEntries();
    }
  }, [isManagement, loadEntries]);

  const onFormField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setSaveStatus('idle');
    setSaveError('');
  };

  const openCreateForm = (defaultLeaseId = '') => {
    setEditingEntryId(null);
    setForm({ ...EMPTY_FORM, lease_id: defaultLeaseId });
    setSaveStatus('idle');
    setSaveError('');
  };

  const openEditForm = (entry) => {
    setEditingEntryId(entry.id);
    setForm({
      lease_id: entry.lease_id,
      period_start: entry.period_start ?? '',
      amount_due: String(entry.amount_due ?? ''),
      amount_paid: String(entry.amount_paid ?? ''),
      due_date: entry.due_date ?? '',
      paid_date: entry.paid_date ?? '',
      payment_method: entry.payment_method ?? '',
      notes: entry.notes ?? '',
    });
    setSaveStatus('idle');
    setSaveError('');
  };

  const closeForm = () => {
    setEditingEntryId(null);
    setForm(EMPTY_FORM);
    setSaveStatus('idle');
    setSaveError('');
  };

  const onSaveEntry = async () => {
    if (!isPortalApiReachable(baseUrl) || !isManagement) return;
    setSaveStatus('saving');
    setSaveError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = {
        emailHint,
        lease_id: form.lease_id,
        period_start: form.period_start,
        amount_due: parseFloat(form.amount_due),
        amount_paid: parseFloat(form.amount_paid) || 0,
        due_date: form.due_date,
        paid_date: form.paid_date || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
      };

      if (editingEntryId) {
        await updateLeasePaymentEntry(baseUrl, token, editingEntryId, payload);
      } else {
        await createLeasePaymentEntry(baseUrl, token, payload);
      }

      setSaveStatus('success');
      await loadEntries({ leaseId: form.lease_id });
    } catch (error) {
      console.error('[Payments] save failed', {
        leaseId: form.lease_id,
        editingEntryId,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      handleApiForbidden(error);
      setSaveStatus('error');
      setSaveError(extractError(error, t, 'portalPayments.errors.saveFailed'));
    }
  };

  return {
    entries,
    entriesStatus,
    entriesError,
    form,
    editingEntryId,
    saveStatus,
    saveError,
    loadEntries,
    onFormField,
    openCreateForm,
    openEditForm,
    closeForm,
    onSaveEntry,
  };
}
