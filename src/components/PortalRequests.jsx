import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Collapse, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
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
    attachmentFile,
    attachmentStatus,
    attachmentError,
    attachmentUploadProgress,
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
    onAttachmentChange,
    onAttachmentSubmit,
    onSuggestReply,
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
    initialSelectedRequestId: selectedRequestFromUrl,
  });

  const portalStateMessage = isAuthenticated
    ? meStatus === 'loading'
      ? { severity: 'info', text: t('portalRequests.loading') }
      : isGuest
        ? { severity: 'warning', text: t('portalRequests.errors.guestBlocked') }
        : null
    : null;

  const [createOpen, setCreateOpen] = useState(false);
  // Close the create form automatically after a successful submission
  React.useEffect(() => {
    if (tenantCreateStatus === 'success') setCreateOpen(false);
  }, [tenantCreateStatus]);

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
            <Button type="button" variant="outlined" size="small" onClick={onExportCsv} sx={{ textTransform: 'none' }}>
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
        {exportStatus === 'ok' && <Alert severity="success">{t('portalRequests.exportSuccess')}</Alert>}

        {!isManagement && (
          <Box>
            <Button
              type="button"
              variant={createOpen ? 'outlined' : 'contained'}
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen((prev) => !prev)}
              disabled={!isAuthenticated || !baseUrl || isGuest}
              sx={{ mb: createOpen ? 1 : 0 }}
            >
              {createOpen
                ? t('portalRequests.actions.hideCreate')
                : t('portalRequests.actions.newRequest')}
            </Button>
            <Collapse in={createOpen} unmountOnExit>
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
              />
            </Collapse>
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
                  if (!isDesktop) {
                    detailPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                } catch {
                  // detail errors are surfaced in detailStatus/detailError
                }
              }}
              onReload={() => loadRequests({ keepSelection: true })}
              reloadDisabled={!isAuthenticated || !baseUrl || isGuest || requestsStatus === 'loading'}
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
                onManagementField={onManagementField}
                onUpdateRequest={onUpdateRequest}
                managementUpdateStatus={managementUpdateStatus}
                managementUpdateError={managementUpdateError}
                onSuggestReply={onSuggestReply}
                suggestionStatus={suggestionStatus}
                suggestionError={suggestionError}
                suggestionText={suggestionText}
                threadMessages={threadMessages}
                messageForm={messageForm}
                setMessageForm={setMessageForm}
                onMessageSubmit={onMessageSubmit}
                messageStatus={messageStatus}
                messageError={messageError}
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
    </Box>
  );
};

export default PortalRequests;
