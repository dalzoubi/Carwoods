import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useLocation, useSearchParams } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { hasLandlordAccess } from '../domain/roleUtils.js';
import { Role } from '../domain/constants.js';
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
import RequestDetailPane from './portalRequests/RequestDetailPane';
import { usePortalRequests } from './portalRequests/usePortalRequests';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import { PortalRequestDetailModalContext } from './PortalRequestDetailModalContext';

const PortalRequestDetailGlobalModal = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const modalCtx = useContext(PortalRequestDetailModalContext);
  const overlayRequestId = modalCtx?.overlayRequestId ?? '';
  const closeRequestDetail = modalCtx?.closeRequestDetail ?? (() => {});

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

  const barePath = pathname.replace(/^\/dark(?=\/)/, '') || '/';
  const isRequestsPath = /\/portal\/requests\/?$/.test(barePath);
  const attachmentFromUrl = isRequestsPath ? searchParams.get('attachment') || '' : '';
  const attachmentTokenFromUrl = isRequestsPath ? searchParams.get('atoken') || '' : '';
  const secureAttachmentDeepLink =
    attachmentFromUrl && attachmentTokenFromUrl
      ? { attachmentId: attachmentFromUrl, accessToken: attachmentTokenFromUrl }
      : null;

  const {
    requestDetail,
    detailStatus,
    detailError,
    threadMessages,
    attachments,
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
    auditEvents,
    auditStatus,
    auditError,
    elsaSettingsError,
    elsaDecisionStatus,
    elsaDecisionError,
    elsaDecisionActionStatus,
    elsaDecisions,
    elsaAutoRespondEnabled,
    onManagementField,
    onUpdateRequest,
    onMessageSubmit,
    onDeleteMessage,
    onAttachmentChange,
    onClearAttachmentFile,
    onAttachmentSubmit,
    onDeleteAttachment,
    onShareAttachment,
    onSetElsaAutoRespond,
    onRunElsa,
    onReviewElsaDecision,
    onCancelRequest,
    cancelStatus,
    cancelError,
    priorityOptions,
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
    initialSelectedRequestId: overlayRequestId,
    secureAttachmentDeepLink,
    listLoadEnabled: false,
  });

  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

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
    if (attachmentDeleteStatus === 'success') showFeedback(t('portalRequests.attachments.deleted'));
  }, [attachmentDeleteStatus, showFeedback, t]);
  React.useEffect(() => {
    if (elsaDecisionActionStatus === 'success') showFeedback(t('portalRequests.elsa.reviewActionSaved'));
  }, [elsaDecisionActionStatus, showFeedback, t]);
  React.useEffect(() => {
    if (detailStatus === 'error') showFeedback(detailError || t('portalRequests.errors.loadFailed'), 'error');
  }, [detailError, detailStatus, showFeedback, t]);
  React.useEffect(() => {
    if (managementUpdateStatus === 'error') showFeedback(managementUpdateError || t('portalRequests.errors.saveFailed'), 'error');
  }, [managementUpdateError, managementUpdateStatus, showFeedback, t]);
  React.useEffect(() => {
    if (messageStatus === 'error') showFeedback(messageError || t('portalRequests.errors.saveFailed'), 'error');
  }, [messageError, messageStatus, showFeedback, t]);
  React.useEffect(() => {
    if (messageDeleteStatus === 'error') showFeedback(messageDeleteError || t('portalRequests.errors.saveFailed'), 'error');
  }, [messageDeleteError, messageDeleteStatus, showFeedback, t]);
  React.useEffect(() => {
    if (attachmentStatus === 'error') showFeedback(attachmentError || t('portalRequests.errors.saveFailed'), 'error');
  }, [attachmentError, attachmentStatus, showFeedback, t]);
  React.useEffect(() => {
    if (attachmentDeleteStatus === 'error') showFeedback(attachmentDeleteError || t('portalRequests.errors.saveFailed'), 'error');
  }, [attachmentDeleteError, attachmentDeleteStatus, showFeedback, t]);
  React.useEffect(() => {
    if (attachmentShareStatus === 'error') showFeedback(attachmentShareError || t('portalRequests.errors.saveFailed'), 'error');
  }, [attachmentShareError, attachmentShareStatus, showFeedback, t]);
  React.useEffect(() => {
    if (cancelStatus === 'error') showFeedback(cancelError || t('portalRequests.errors.saveFailed'), 'error');
  }, [cancelError, cancelStatus, showFeedback, t]);
  React.useEffect(() => {
    if (auditStatus === 'error') showFeedback(auditError || t('portalRequests.errors.loadFailed'), 'error');
  }, [auditError, auditStatus, showFeedback, t]);
  React.useEffect(() => {
    if (elsaSettingsError) showFeedback(elsaSettingsError, 'error');
  }, [elsaSettingsError, showFeedback]);
  React.useEffect(() => {
    if (elsaDecisionStatus === 'error') showFeedback(elsaDecisionError || t('portalRequests.errors.saveFailed'), 'error');
  }, [elsaDecisionError, elsaDecisionStatus, showFeedback, t]);

  const handleClose = () => {
    closeRequestDetail();
    if (isRequestsPath) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('id');
          return next;
        },
        { replace: true }
      );
    }
  };

  const open = Boolean(overlayRequestId) && isAuthenticated && meStatus === 'ok' && !isGuest;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="lg"
        scroll="paper"
        aria-labelledby="portal-request-detail-global-dialog-title"
      >
        <DialogTitle
          id="portal-request-detail-global-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            pr: 1,
          }}
        >
          <Typography component="span" variant="h6" sx={{ flex: 1, wordBreak: 'break-word', pt: 0.25 }}>
            {requestDetail?.title || t('portalRequests.detailModal.title')}
          </Typography>
          <IconButton
            type="button"
            size="small"
            onClick={handleClose}
            aria-label={t('portalRequests.actions.close')}
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          {overlayRequestId ? (
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
              onClearAttachmentFile={onClearAttachmentFile}
              onAttachmentSubmit={onAttachmentSubmit}
              attachmentFile={attachmentFile}
              attachmentStatus={attachmentStatus}
              attachmentError={attachmentError}
              attachmentRetryHint={attachmentRetryHint}
              attachmentErrorDebugId={attachmentErrorDebugId}
              attachmentUploadProgress={attachmentUploadProgress}
              attachmentDeleteStatus={attachmentDeleteStatus}
              attachmentDeleteError={attachmentDeleteError}
              onDeleteAttachment={onDeleteAttachment}
              onShareAttachment={onShareAttachment}
              currentUserId={meData?.user?.id || ''}
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
          ) : null}
        </DialogContent>
      </Dialog>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </>
  );
};

export default PortalRequestDetailGlobalModal;
