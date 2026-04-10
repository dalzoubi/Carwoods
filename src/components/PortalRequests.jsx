import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useLocation } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { Role } from '../domain/constants.js';
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
import TenantRequestForm from './portalRequests/TenantRequestForm';
import RequestListPane from './portalRequests/RequestListPane';
import RequestDetailPane from './portalRequests/RequestDetailPane';
import { usePortalRequests } from './portalRequests/usePortalRequests';
import StatusAlertSlot from './StatusAlertSlot';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import { fetchLandlords } from '../lib/portalApiClient';

const PortalRequests = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const selectedRequestFromUrl = new URLSearchParams(location.search).get('id') || '';
  const listPaneRef = useRef(null);
  const detailPaneRef = useRef(null);
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

  const {
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
    attachmentUploadProgress,
    exportStatus,
    exportError,
    auditEvents,
    auditStatus,
    auditError,
    elsaSettingsError,
    elsaDecisionStatus,
    elsaDecisionError,
    elsaDecisionActionStatus,
    elsaDecisions,
    elsaAutoRespondEnabled,
    loadRequestDetails,
    loadAuditForRequest,
    loadElsaContext,
    loadRequests,
    onTenantField,
    onCreateAttachmentChange,
    onRemoveCreateAttachment,
    createAttachmentFiles,
    onCreateRequest,
    onCancelRequest,
    cancelStatus,
    cancelError,
    onManagementField,
    onUpdateRequest,
    onMessageSubmit,
    onDeleteMessage,
    onAttachmentChange,
    onAttachmentSubmit,
    onExportCsv,
    onSetElsaAutoRespond,
    onRunElsa,
    onReviewElsaDecision,
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
    initialSelectedRequestId: selectedRequestFromUrl,
  });

  const portalStateMessage = isAuthenticated
    ? meStatus === 'loading'
      ? { severity: 'info', text: t('portalRequests.loading') }
      : isGuest
        ? { severity: 'warning', text: t('portalRequests.errors.guestBlocked') }
        : null
    : null;
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const [createOpen, setCreateOpen] = useState(false);
  const [landlords, setLandlords] = useState([]);
  const [landlordsStatus, setLandlordsStatus] = useState('idle');
  const [selectedLandlordId, setSelectedLandlordId] = useState('');

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
  React.useEffect(() => {
    if (tenantCreateStatus === 'success') showFeedback(t('portalRequests.create.saved'));
  }, [showFeedback, t, tenantCreateStatus]);
  React.useEffect(() => {
    if (cancelStatus === 'success') showFeedback(t('portalRequests.cancel.cancelled'));
  }, [cancelStatus, showFeedback, t]);
  React.useEffect(() => {
    if (managementUpdateStatus === 'success') showFeedback(t('portalRequests.management.saved'));
  }, [managementUpdateStatus, showFeedback, t]);
  React.useEffect(() => {
    if (messageStatus === 'success') showFeedback(t('portalRequests.messages.sent'));
  }, [messageStatus, showFeedback, t]);
  React.useEffect(() => {
    if (messageDeleteStatus === 'success') showFeedback(t('portalRequests.messages.deleted'));
  }, [messageDeleteStatus, showFeedback, t]);
  React.useEffect(() => {
    if (attachmentStatus === 'success') showFeedback(t('portalRequests.attachments.saved'));
  }, [attachmentStatus, showFeedback, t]);
  React.useEffect(() => {
    if (elsaDecisionActionStatus === 'success') showFeedback(t('portalRequests.elsa.reviewActionSaved'));
  }, [elsaDecisionActionStatus, showFeedback, t]);
  React.useEffect(() => {
    if (exportStatus === 'ok') showFeedback(t('portalRequests.exportSuccess'));
  }, [exportStatus, showFeedback, t]);

  return (
    <Box>
      <Helmet>
        <title>{t('portalRequests.title')}</title>
        <meta name="description" content={t('portalRequests.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h5" component="h2" fontWeight={700}>
              {t('portalRequests.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalRequests.intro')}
            </Typography>
          </Box>
          {isManagement && (
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={onExportCsv}
              disabled={exportStatus === 'loading'}
              startIcon={exportStatus === 'loading' ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ textTransform: 'none' }}
            >
              {exportStatus === 'loading'
                ? t('portalRequests.actions.exportingCsv')
                : t('portalRequests.actions.exportCsv')}
            </Button>
          )}
        </Stack>

        {!baseUrl && <Alert severity="warning">{t('portalRequests.errors.apiUnavailable')}</Alert>}
        {!isAuthenticated && <Alert severity="warning">{t('portalRequests.errors.signInRequired')}</Alert>}
        <StatusAlertSlot message={portalStateMessage} />
        {exportStatus === 'error' && <Alert severity="error">{exportError || t('portalRequests.errors.loadFailed')}</Alert>}

        {!isManagement && (
          <Box>
            <Button
              type="button"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              disabled={!isAuthenticated || !baseUrl || isGuest}
            >
              {t('portalRequests.actions.newRequest')}
            </Button>
            <Dialog
              open={createOpen}
              onClose={() => {
                if (tenantCreateStatus !== 'saving') setCreateOpen(false);
              }}
              fullWidth
              maxWidth="md"
            >
              <DialogTitle>{t('portalRequests.create.heading')}</DialogTitle>
              <DialogContent dividers>
              <TenantRequestForm
                tenantForm={tenantForm}
                tenantDefaults={tenantDefaults}
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
                disabled={!isAuthenticated || !baseUrl || tenantCreateStatus === 'saving' || isGuest}
                hideHeading
                framed={false}
              />
              </DialogContent>
              <DialogActions>
                <Button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={tenantCreateStatus === 'saving'}
                >
                  {t('portalRequests.actions.close')}
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* Split pane: list + detail side by side on desktop */}
        <Stack
          direction={isDesktop ? 'row' : 'column'}
          spacing={2}
          sx={{ alignItems: 'flex-start' }}
        >
          {/* List pane */}
          <Paper
            ref={listPaneRef}
            variant="outlined"
            sx={{
              width: isDesktop ? 340 : '100%',
              minWidth: isDesktop ? 340 : undefined,
              flexShrink: 0,
              p: 2,
              borderRadius: 2,
              maxHeight: isDesktop ? 'calc(100vh - 200px)' : undefined,
              overflow: 'auto',
            }}
          >
            <RequestListPane
              requests={requests}
              requestsStatus={requestsStatus}
              requestsError={requestsError}
              selectedRequestId={selectedRequestId}
              onSelectRequest={async (id) => {
                setSelectedRequestId(id);
                try {
                  await loadRequestDetails(id);
                  await loadAuditForRequest(id);
                  await loadElsaContext(id);
                  if (!isDesktop) {
                    detailPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                } catch {
                  // detail errors are surfaced in detailStatus/detailError
                }
              }}
              onReload={() => loadRequests({ keepSelection: true })}
              reloadDisabled={!isAuthenticated || !baseUrl || isGuest || requestsStatus === 'loading'}
              isAdmin={isAdmin}
              landlords={landlords}
              landlordsStatus={landlordsStatus}
              selectedLandlordId={selectedLandlordId}
              onSelectLandlord={setSelectedLandlordId}
            />
          </Paper>

          {/* Detail pane */}
          <Paper
            variant="outlined"
            ref={detailPaneRef}
            sx={{
              flex: 1,
              p: 2,
              borderRadius: 2,
              minWidth: 0,
              width: isDesktop ? undefined : '100%',
            }}
          >
            {!isDesktop && selectedRequestId && (
              <Box sx={{ mb: 1.5 }}>
                <Button
                  type="button"
                  size="small"
                  onClick={() => {
                    setSelectedRequestId('');
                    listPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {t('portalRequests.actions.backToList')}
                </Button>
              </Box>
            )}
            {selectedRequestId ? (
              <RequestDetailPane
                requestDetail={requestDetail}
                detailStatus={detailStatus}
                detailError={detailError}
                isManagement={isManagement}
                isAdmin={isAdmin}
                managementForm={managementForm}
                managementStatusOptions={managementStatusOptions}
                managementPriorityOptions={priorityOptions}
                onManagementField={onManagementField}
                onUpdateRequest={onUpdateRequest}
                managementUpdateStatus={managementUpdateStatus}
                managementUpdateError={managementUpdateError}
                threadMessages={threadMessages}
                messageForm={messageForm}
                setMessageForm={setMessageForm}
                onMessageSubmit={onMessageSubmit}
                messageStatus={messageStatus}
                messageError={messageError}
                messageDeleteStatus={messageDeleteStatus}
                messageDeleteError={messageDeleteError}
                onDeleteMessage={onDeleteMessage}
                attachments={attachments}
                onAttachmentChange={onAttachmentChange}
                onAttachmentSubmit={onAttachmentSubmit}
                attachmentFile={attachmentFile}
                attachmentStatus={attachmentStatus}
                attachmentError={attachmentError}
                attachmentUploadProgress={attachmentUploadProgress}
                auditEvents={auditEvents}
                auditStatus={auditStatus}
                auditError={auditError}
                elsaSettingsError={elsaSettingsError}
                elsaDecisionStatus={elsaDecisionStatus}
                elsaDecisionError={elsaDecisionError}
                elsaDecisionActionStatus={elsaDecisionActionStatus}
                elsaDecisions={elsaDecisions}
                elsaAutoRespondEnabled={elsaAutoRespondEnabled}
                onSetElsaAutoRespond={onSetElsaAutoRespond}
                onRunElsa={onRunElsa}
                onReviewElsaDecision={onReviewElsaDecision}
                onCancelRequest={onCancelRequest}
                cancelStatus={cancelStatus}
                cancelError={cancelError}
              />
            ) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="body2">
                  {requests.length > 0
                    ? t('portalRequests.list.selectPrompt')
                    : t('portalRequests.list.empty')}
                </Typography>
              </Box>
            )}
          </Paper>
        </Stack>
      </Stack>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalRequests;
