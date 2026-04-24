import { useCallback, useState } from 'react';
import { isPortalApiReachable } from '../../featureFlags';
import { emailFromAccount } from '../../portalUtils';
import {
  fetchPaymentsApi,
  createLeasePaymentEntry,
  updateLeasePaymentEntry,
  deleteLandlordPaymentEntry,
} from '../../lib/portalApiClient';

const EMPTY_FORM = {
  lease_id: '',
  property_id: '',
  tenant_user_id: '',
  show_in_tenant_portal: true,
  period_start: '',
  payment_type: 'RENT',
  amount_due: '',
  amount_paid: '',
  due_date: '',
  paid_date: '',
  payment_method: '',
  notes: '',
};

function extractError(t, fallbackKey) {
  const base = t(fallbackKey);
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

  const loadEntries = useCallback(
    async (opts = {}) => {
      const { propertyId, portalPropertyId, leaseId } = opts;
      const landlordPropertyId = String(propertyId ?? '').trim();
      const listLeaseId = String(leaseId ?? '').trim();
      const tenantPropertyFilter = String(portalPropertyId ?? '').trim();
      if (!isPortalApiReachable(baseUrl) || !isAuthenticated || isGuest || meStatus !== 'ok') return;
      if (!isManagement && !listPath) return;
      if (isManagement && !landlordPropertyId) return;

      setEntriesStatus('loading');
      setEntriesError('');
      try {
        const token = await getAccessToken();
        const emailHint = emailFromAccount(account);
        let path;
        if (isManagement) {
          const q = new URLSearchParams();
          q.set('property_id', landlordPropertyId);
          if (listLeaseId) {
            q.set('lease_id', listLeaseId);
          }
          path = `/api/landlord/payments?${q.toString()}`;
        } else {
          path = listPath;
          if (tenantPropertyFilter) {
            const q = new URLSearchParams();
            q.set('property_id', tenantPropertyFilter);
            path = `${listPath}?${q.toString()}`;
          }
        }
        const data = await fetchPaymentsApi(baseUrl, token, { path, emailHint });
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
        setEntriesStatus('ok');
      } catch (error) {
        console.error('[Payments] loadEntries failed', {
          scope: isManagement ? 'landlord' : 'portal',
          propertyId: isManagement ? landlordPropertyId : undefined,
          leaseId: isManagement ? listLeaseId : undefined,
          status: error?.status,
          code: error?.code,
          message: error?.message,
          ...(error?.details ? { details: error.details } : {}),
        });
        handleApiForbidden(error);
        setEntriesStatus('error');
        setEntriesError(extractError(t, 'portalPayments.errors.loadFailed'));
      }
    },
    [baseUrl, isAuthenticated, isGuest, isManagement, meStatus, getAccessToken, account, handleApiForbidden, t, listPath]
  );

  const onFormField = (field) => (event) => {
    const v = event.target.value;
    setForm((prev) => ({ ...prev, [field]: v }));
    setSaveStatus('idle');
    setSaveError('');
  };

  const onFormCheckbox = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.checked }));
    setSaveStatus('idle');
    setSaveError('');
  };

  const openCreateForm = (defaults = {}) => {
    setEditingEntryId(null);
    setForm({
      ...EMPTY_FORM,
      property_id: defaults.property_id ?? '',
      lease_id: defaults.lease_id ?? '',
      tenant_user_id: defaults.tenant_user_id ?? '',
      show_in_tenant_portal: defaults.show_in_tenant_portal !== undefined ? defaults.show_in_tenant_portal : !defaults.lease_id,
    });
    setSaveStatus('idle');
    setSaveError('');
  };

  const openEditForm = (entry) => {
    setEditingEntryId(entry.id);
    setForm({
      lease_id: entry.lease_id != null && entry.lease_id !== '' ? String(entry.lease_id) : '',
      property_id: entry.property_id != null && entry.property_id !== '' ? String(entry.property_id) : '',
      tenant_user_id: entry.tenant_user_id != null && entry.tenant_user_id !== '' ? String(entry.tenant_user_id) : '',
      show_in_tenant_portal: Boolean(entry.show_in_tenant_portal),
      period_start: entry.period_start ?? '',
      payment_type: entry.payment_type ?? 'RENT',
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

  const onSaveEntry = async (reloadPropertyId, reloadLeaseId) => {
    if (!isPortalApiReachable(baseUrl) || !isManagement) return;
    setSaveStatus('saving');
    setSaveError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const basePayload = {
        emailHint,
        period_start: form.period_start,
        amount_due: parseFloat(form.amount_due),
        amount_paid: parseFloat(form.amount_paid) || 0,
        due_date: form.due_date,
        paid_date: form.paid_date || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        show_in_tenant_portal: form.show_in_tenant_portal,
      };

      let payload = { ...basePayload };
      if (!editingEntryId) {
        payload.payment_type = form.payment_type || 'RENT';
        if (form.lease_id) {
          payload.lease_id = form.lease_id;
        } else if (form.tenant_user_id) {
          payload.property_id = form.property_id;
          payload.tenant_user_id = form.tenant_user_id;
        } else {
          payload.property_id = form.property_id;
        }
      } else {
        // PATCH only allows patch fields; scope is immutable
        payload = { emailHint, ...basePayload };
      }

      if (editingEntryId) {
        await updateLeasePaymentEntry(baseUrl, token, editingEntryId, payload);
      } else {
        await createLeasePaymentEntry(baseUrl, token, payload);
      }

      setSaveStatus('success');
      if (reloadPropertyId) {
        const rLease = String(reloadLeaseId ?? '').trim();
        await loadEntries({
          propertyId: String(reloadPropertyId).trim(),
          leaseId: rLease || undefined,
        });
      }
    } catch (error) {
      console.error('[Payments] save failed', {
        editingEntryId,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      handleApiForbidden(error);
      setSaveStatus('error');
      setSaveError(extractError(t, 'portalPayments.errors.saveFailed'));
    }
  };

  const onDeleteEntry = async (entryId, reloadPropertyId, reloadLeaseId) => {
    if (!isPortalApiReachable(baseUrl) || !isManagement) return;
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await deleteLandlordPaymentEntry(baseUrl, token, entryId, { emailHint });
      if (reloadPropertyId) {
        const rLease = String(reloadLeaseId ?? '').trim();
        await loadEntries({
          propertyId: String(reloadPropertyId).trim(),
          leaseId: rLease || undefined,
        });
      }
    } catch (error) {
      handleApiForbidden(error);
      throw error;
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
    onFormCheckbox,
    openCreateForm,
    openEditForm,
    closeForm,
    onSaveEntry,
    onDeleteEntry,
  };
}
