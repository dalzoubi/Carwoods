import React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Chip, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { isGuestRole, resolveRole } from '../portalUtils';
import { normalizedRole } from './portalRequests/api';
import TenantRequestForm from './portalRequests/TenantRequestForm';
import RequestListPane from './portalRequests/RequestListPane';
import RequestDetailPane from './portalRequests/RequestDetailPane';
import { usePortalRequests } from './portalRequests/usePortalRequests';
import StatusAlertSlot from './StatusAlertSlot';

const PortalRequests = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
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

  const hasDetail = selectedRequestId && requestDetail;

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
              {t('portalRequests.actions.exportCsv')}
            </Button>
          )}
        </Stack>

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

        {/* Split pane: list + detail side by side on desktop */}
        <Stack
          direction={isDesktop ? 'row' : 'column'}
          spacing={2}
          sx={{ alignItems: 'flex-start' }}
        >
          {/* List pane */}
          <Paper
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
                await loadRequestDetails(id);
              }}
              onReload={() => loadRequests({ keepSelection: true })}
              reloadDisabled={!isAuthenticated || !baseUrl || isGuest || requestsStatus === 'loading'}
            />
          </Paper>

          {/* Detail pane */}
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              p: 2,
              borderRadius: 2,
              minWidth: 0,
              width: isDesktop ? undefined : '100%',
            }}
          >
            {hasDetail ? (
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
            ) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="body2">
                  {requests.length > 0
                    ? t('portalRequests.list.empty').replace('No requests found', 'Select a request to view details')
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
