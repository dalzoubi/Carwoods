import React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { hasLandlordAccess, usePortalAuth } from '../PortalAuthContext';
import { isGuestRole, resolveRole } from '../portalUtils';
import { normalizedRole } from './portalRequests/api';
import TenantRequestForm from './portalRequests/TenantRequestForm';
import RequestListPane from './portalRequests/RequestListPane';
import RequestDetailPane from './portalRequests/RequestDetailPane';
import { usePortalRequests } from './portalRequests/usePortalRequests';
import StatusAlertSlot from './StatusAlertSlot';

const PortalRequests = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
  } = usePortalAuth();

  const role = normalizedRole(resolveRole(meData, account));
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const isGuest = roleResolved && isGuestRole(role);
  const isManagement = hasLandlordAccess(role);

  const {
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
  } = usePortalRequests({
    baseUrl,
    isAuthenticated,
    isGuest,
    isManagement,
    meStatus,
    account,
    getAccessToken,
    t,
  });

  const portalStateMessage = isAuthenticated
    ? meStatus === 'loading'
      ? { severity: 'info', text: t('portalRequests.loading') }
      : isGuest
        ? { severity: 'warning', text: t('portalRequests.errors.guestBlocked') }
        : null
    : null;

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalRequests.title')}</title>
        <meta name="description" content={t('portalRequests.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalRequests.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalRequests.intro')}</Typography>

        {isManagement && (
          <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
            <Button type="button" variant="outlined" onClick={onExportCsv}>
              {t('portalRequests.actions.exportCsv')}
            </Button>
          </Stack>
        )}

        {!baseUrl && <Alert severity="warning">{t('portalRequests.errors.apiUnavailable')}</Alert>}
        {!isAuthenticated && <Alert severity="warning">{t('portalRequests.errors.signInRequired')}</Alert>}
        <StatusAlertSlot message={portalStateMessage} />
        {exportStatus === 'error' && <Alert severity="error">{exportError || t('portalRequests.errors.loadFailed')}</Alert>}
        {exportStatus === 'ok' && <Alert severity="success">{t('portalRequests.exportSuccess')}</Alert>}

        {!isManagement && (
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
            disabled={!isAuthenticated || !baseUrl || tenantCreateStatus === 'saving' || isGuest}
          />
        )}

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2.5,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={2}>
            <RequestListPane
              requests={requests}
              requestsStatus={requestsStatus}
              requestsError={requestsError}
              selectedRequestId={selectedRequestId}
              onSelectRequest={async (id) => {
                setSelectedRequestId(id);
                await loadRequestDetails(id);
              }}
              onReload={() => loadRequests({ keepSelection: true })}
              reloadDisabled={!isAuthenticated || !baseUrl || isGuest || requestsStatus === 'loading'}
            />
            {requests.length > 0 && (
              <RequestDetailPane
                requestDetail={requestDetail}
                isManagement={isManagement}
                managementForm={managementForm}
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
              />
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PortalRequests;

