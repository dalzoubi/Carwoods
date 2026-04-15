import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useSearchParams } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { Role } from '../domain/constants.js';
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
import TenantRequestForm from './portalRequests/TenantRequestForm';
import RequestListPane from './portalRequests/RequestListPane';
import { usePortalRequests } from './portalRequests/usePortalRequests';
import StatusAlertSlot from './StatusAlertSlot';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalConfirmDialog from './PortalConfirmDialog';
import { fetchLandlords } from '../lib/portalApiClient';
import { usePortalRequestDetailModal } from './PortalRequestDetailModalContext';
import { allowsCsvExport, landlordTierLimits } from '../portalTierUtils';

const PortalRequests = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRequestFromUrl = searchParams.get('id') || '';
  const highlightMsgFromUrl = searchParams.get('hlMsg') || '';
  const highlightAttFromUrl = searchParams.get('hlAtt') || '';
  const highlightDecFromUrl = searchParams.get('hlDec') || '';
  const attachmentFromUrl = searchParams.get('attachment') || '';
  const attachmentTokenFromUrl = searchParams.get('atoken') || '';
  const secureAttachmentDeepLink =
    attachmentFromUrl && attachmentTokenFromUrl
      ? { attachmentId: attachmentFromUrl, accessToken: attachmentTokenFromUrl }
      : null;
  const createFromUrl = searchParams.get('create') === '1';
  const statusFilterFromUrl = searchParams.get('status') || 'all';
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
    handleApiForbidden,
  } = usePortalAuth();

  const role = normalizeRole(resolveRole(meData, account));
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const isGuest = roleResolved && isGuestRole(role);
  const isManagement = hasLandlordAccess(role);
  const isAdmin = role === Role.ADMIN;
  const csvExportAllowed = isAdmin || allowsCsvExport(landlordTierLimits(meData));
  const [selectedLandlordId, setSelectedLandlordId] = useState('');

  const {
    requestsStatus,
    requestsError,
    requests,
    tenantForm,
    tenantCreateDefaults,
    tenantCreateSubscriptionFeatures,
    managementCreateLeaseOptions,
    managementCreateLeaseId,
    setManagementCreateLeaseId,
    lookupStatus,
    lookupError,
    lookupContact,
    categoryOptions,
    priorityOptions,
    tenantCreateStatus,
    tenantCreateError,
    exportStatus,
    exportError,
    loadRequests,
    onTenantField,
    onCreateAttachmentChange,
    onRemoveCreateAttachment,
    createAttachmentFiles,
    onCreateRequest,
    onExportCsv,
  } = usePortalRequests({
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
    initialSelectedRequestId: '',
    secureAttachmentDeepLink,
    syncDetailFromUrl: false,
    listSelectionHintId: selectedRequestFromUrl,
    adminRequestLookupsLandlordId: isAdmin ? selectedLandlordId : '',
  });

  const { openRequestDetail, closeRequestDetail } = usePortalRequestDetailModal();

  React.useEffect(() => {
    const id = selectedRequestFromUrl.trim();
    const highlight = {};
    const hm = highlightMsgFromUrl.trim();
    const ha = highlightAttFromUrl.trim();
    const hd = highlightDecFromUrl.trim();
    if (hm) highlight.messageId = hm;
    if (ha) highlight.attachmentId = ha;
    if (hd) highlight.decisionId = hd;
    if (id) openRequestDetail(id, Object.keys(highlight).length ? highlight : null);
    else closeRequestDetail();
  }, [
    selectedRequestFromUrl,
    highlightMsgFromUrl,
    highlightAttFromUrl,
    highlightDecFromUrl,
    openRequestDetail,
    closeRequestDetail,
  ]);

  const portalStateMessage = isAuthenticated
    ? meStatus === 'loading'
      ? { severity: 'info', text: t('portalRequests.loading') }
      : isGuest
        ? { severity: 'warning', text: t('portalRequests.errors.guestBlocked') }
        : null
    : null;
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const [createOpen, setCreateOpen] = useState(createFromUrl);
  const createBaselineRef = useRef('');
  const [discardCreateOpen, setDiscardCreateOpen] = useState(false);
  const [landlords, setLandlords] = useState([]);
  const [landlordsStatus, setLandlordsStatus] = useState('idle');

  React.useEffect(() => {
    if (!isAdmin || !baseUrl || !isAuthenticated || isGuest || meStatus !== 'ok') {
      setLandlords([]);
      setLandlordsStatus('idle');
      setSelectedLandlordId('');
      return;
    }

    let cancelled = false;
    const loadLandlords = async () => {
      setLandlordsStatus('loading');
      try {
        const accessToken = await getAccessToken();
        const payload = await fetchLandlords(baseUrl, accessToken, { includeInactive: false });
        if (cancelled) return;
        const rows = Array.isArray(payload?.landlords) ? payload.landlords : [];
        setLandlords(rows);
        setLandlordsStatus('ok');
        setSelectedLandlordId((prev) => (rows.some((landlord) => landlord.id === prev) ? prev : ''));
      } catch (error) {
        if (cancelled) return;
        handleApiForbidden(error);
        setLandlords([]);
        setLandlordsStatus('error');
      }
    };

    loadLandlords();
    return () => {
      cancelled = true;
    };
  }, [
    baseUrl,
    getAccessToken,
    handleApiForbidden,
    isAdmin,
    isAuthenticated,
    isGuest,
    meStatus,
  ]);

  // Close the create form automatically after a successful submission
  React.useEffect(() => {
    if (tenantCreateStatus === 'success') setCreateOpen(false);
  }, [tenantCreateStatus]);
  const createDraftSnapshot = JSON.stringify({
    category_code: tenantForm.category_code,
    priority_code: tenantForm.priority_code,
    title: tenantForm.title,
    description: tenantForm.description,
    managementCreateLeaseId: isManagement ? managementCreateLeaseId : '',
    attachments: (createAttachmentFiles || []).map((file) => `${file.name}:${file.size}`),
  });
  const hasCreateUnsavedChanges = createOpen && createDraftSnapshot !== createBaselineRef.current;
  React.useEffect(() => {
    if (!createOpen) return;
    if (!createBaselineRef.current) {
      createBaselineRef.current = createDraftSnapshot;
    }
  }, [createDraftSnapshot, createOpen]);
  const openCreateDialog = () => {
    createBaselineRef.current = createDraftSnapshot;
    setCreateOpen(true);
  };
  const attemptCloseCreateDialog = () => {
    if (tenantCreateStatus === 'saving') return;
    if (hasCreateUnsavedChanges) {
      setDiscardCreateOpen(true);
      return;
    }
    setCreateOpen(false);
  };
  React.useEffect(() => {
    if (tenantCreateStatus === 'success') showFeedback(t('portalRequests.create.saved'));
  }, [showFeedback, t, tenantCreateStatus]);
  React.useEffect(() => {
    if (exportStatus === 'ok') showFeedback(t('portalRequests.exportSuccess'));
  }, [exportStatus, showFeedback, t]);
  React.useEffect(() => {
    if (requestsStatus === 'error') showFeedback(requestsError || t('portalRequests.errors.loadFailed'), 'error');
  }, [requestsError, requestsStatus, showFeedback, t]);
  React.useEffect(() => {
    if (tenantCreateStatus === 'error') showFeedback(tenantCreateError || t('portalRequests.errors.saveFailed'), 'error');
  }, [tenantCreateError, tenantCreateStatus, showFeedback, t]);
  React.useEffect(() => {
    if (exportStatus === 'error') showFeedback(exportError || t('portalRequests.errors.loadFailed'), 'error');
  }, [exportError, exportStatus, showFeedback, t]);

  const setRequestIdInUrl = (id) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('id', id);
        else next.delete('id');
        next.delete('hlMsg');
        next.delete('hlAtt');
        next.delete('hlDec');
        return next;
      },
      { replace: true }
    );
  };

  return (
    <Box>
      <Helmet>
        <title>{t('portalRequests.title')}</title>
        <meta name="description" content={t('portalRequests.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" component="h2" fontWeight={700}>
            {t('portalRequests.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.intro')}
          </Typography>
        </Box>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalRequests.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalRequests.errors.signInRequired') } : null}
        />
        <StatusAlertSlot message={portalStateMessage} />
        <StatusAlertSlot
          message={exportStatus === 'error'
            ? { severity: 'error', text: exportError || t('portalRequests.errors.loadFailed') }
            : null}
        />

        {!isGuest && (
          <Box>
            <Dialog
              open={createOpen}
              onClose={attemptCloseCreateDialog}
              fullWidth
              maxWidth="md"
            >
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography component="span">{t('portalRequests.create.heading')}</Typography>
                <IconButton
                  type="button"
                  size="small"
                  onClick={attemptCloseCreateDialog}
                  disabled={tenantCreateStatus === 'saving'}
                  aria-label={t('portalDialogs.closeForm')}
                >
                  <Close fontSize="small" />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                {isManagement && isAdmin && !selectedLandlordId ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {t('portalRequests.create.adminSelectLandlordFirst')}
                  </Alert>
                ) : null}
                {isManagement ? (
                  <TextField
                    select
                    margin="dense"
                    label={t('portalRequests.create.leaseForTenantsLabel')}
                    value={managementCreateLeaseId}
                    onChange={(event) => setManagementCreateLeaseId(event.target.value)}
                    disabled={
                      tenantCreateStatus === 'saving'
                      || (isAdmin && !selectedLandlordId)
                      || managementCreateLeaseOptions.length === 0
                    }
                    helperText={
                      managementCreateLeaseOptions.length === 0
                        ? isAdmin && !selectedLandlordId
                          ? t('portalRequests.create.adminSelectLandlordFirst')
                          : t('portalRequests.create.noLeasesForCreate')
                        : ''
                    }
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    {managementCreateLeaseOptions.map((opt) => (
                      <MenuItem key={opt.lease_id} value={opt.lease_id}>
                        {`${opt.tenant_names || t('portalRequests.create.tenantHousehold')} — ${opt.property_address || ''}`}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
                <TenantRequestForm
                  tenantForm={tenantForm}
                  tenantDefaults={tenantCreateDefaults}
                  subscriptionFeatures={tenantCreateSubscriptionFeatures}
                  lookupsStatus={lookupStatus}
                  lookupsError={lookupError}
                  lookupContact={lookupContact}
                  categoryOptions={categoryOptions}
                  priorityOptions={priorityOptions}
                  onTenantField={onTenantField}
                  onCreateRequest={onCreateRequest}
                  tenantCreateStatus={tenantCreateStatus}
                  tenantCreateError={tenantCreateError}
                  createAttachmentFiles={createAttachmentFiles}
                  onCreateAttachmentChange={onCreateAttachmentChange}
                  onRemoveCreateAttachment={onRemoveCreateAttachment}
                  onCancel={attemptCloseCreateDialog}
                  disabled={!isAuthenticated || !baseUrl || tenantCreateStatus === 'saving' || isGuest}
                  hideHeading
                  framed={false}
                  showOnBehalfTenantHint={isManagement}
                  missingLeaseSelection={isManagement && !tenantCreateDefaults}
                />
              </DialogContent>
            </Dialog>
            <PortalConfirmDialog
              open={discardCreateOpen}
              onClose={() => setDiscardCreateOpen(false)}
              onConfirm={() => {
                setDiscardCreateOpen(false);
                setCreateOpen(false);
              }}
              title={t('portalDialogs.unsavedChanges.title')}
              body={t('portalDialogs.unsavedChanges.body')}
              confirmLabel={t('portalDialogs.unsavedChanges.discard')}
              cancelLabel={t('portalDialogs.unsavedChanges.keepEditing')}
              confirmColor="warning"
            />
          </Box>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, width: '100%', maxWidth: 960 }}>
          <RequestListPane
            requests={requests}
            requestsStatus={requestsStatus}
            requestsError={requestsError}
            initialStatusFilter={statusFilterFromUrl}
            selectedRequestId={selectedRequestFromUrl}
            onSelectRequest={(id) => {
              setRequestIdInUrl(id);
              openRequestDetail(id);
            }}
            onReload={() => loadRequests({ keepSelection: true })}
            reloadDisabled={!isAuthenticated || !baseUrl || isGuest || requestsStatus === 'loading'}
            showNewRequestButton
            onNewRequest={openCreateDialog}
            newRequestDisabled={
              !isAuthenticated
              || !baseUrl
              || isGuest
              || (isAdmin && !selectedLandlordId)
            }
            isAdmin={isAdmin}
            isManagement={isManagement}
            csvExportAllowed={csvExportAllowed}
            exportStatus={exportStatus}
            onExportCsv={onExportCsv}
            landlords={landlords}
            landlordsStatus={landlordsStatus}
            selectedLandlordId={selectedLandlordId}
            onSelectLandlord={setSelectedLandlordId}
          />
        </Paper>

      </Stack>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalRequests;
