import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Link,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import InlineActionStatus from '../InlineActionStatus';
import { AttachmentUploadControl } from '..';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const TenantRequestForm = ({
  tenantForm,
  tenantDefaults,
  subscriptionFeatures = null,
  categoryOptions,
  priorityOptions,
  lookupsStatus,
  lookupsError,
  lookupContact,
  onTenantField,
  onCreateRequest,
  onCancel,
  tenantCreateStatus,
  tenantCreateError,
  createAttachmentFiles,
  onCreateAttachmentChange,
  onRemoveCreateAttachment,
  disabled,
  hideHeading = false,
  framed = true,
  showOnBehalfTenantHint = false,
  missingLeaseSelection = false,
}) => {
  const { t } = useTranslation();
  const [isDropActive, setIsDropActive] = useState(false);
  /** Landlord/admin on-behalf create: require explicit tier payload (null → uploads off until loaded). */
  const allowAttachments = showOnBehalfTenantHint
    ? Boolean(subscriptionFeatures?.request_photo_video_attachments_enabled)
    : (subscriptionFeatures == null
      || Boolean(subscriptionFeatures.request_photo_video_attachments_enabled));
  const attachmentsFreeTierLocked =
    subscriptionFeatures != null
    && subscriptionFeatures.request_photo_video_attachments_enabled === false;
  const mailSubject = encodeURIComponent('Issues creating a maintenance request via carwoods.com');
  const contactHref = lookupContact?.email
    ? `mailto:${lookupContact.email}?subject=${mailSubject}`
    : '';
  const createStatusMessage = tenantCreateStatus === 'error'
    ? { severity: 'error', text: tenantCreateError || t('portalRequests.errors.saveFailed') }
    : null;
  const lookupsStatusMessage = lookupsStatus === 'loading'
    ? { severity: 'info', text: t('portalRequests.loading') }
    : lookupsStatus === 'error'
      ? {
        severity: 'error',
        text: lookupContact?.email
          ? (
            <>
              {t('portalRequests.errors.noTenantLeaseAccessWithContactPrefix', {
                name: lookupContact.name || t('portalRequests.errors.landlordFallbackName'),
              })}
              {' '}
              <Link href={contactHref}>{lookupContact.email}</Link>
              .
            </>
          )
          : (lookupsError || t('portalRequests.errors.loadFailed')),
      }
      : null;
  const lookupsUnavailable =
    lookupsStatus !== 'ok'
    || categoryOptions.length === 0
    || priorityOptions.length === 0
    || missingLeaseSelection;
  const sortedCategoryOptions = useMemo(
    () =>
      [...categoryOptions].sort((a, b) =>
        collator.compare(String(a?.name ?? a?.code ?? ''), String(b?.name ?? b?.code ?? ''))
      ),
    [categoryOptions]
  );
  const sortedPriorityOptions = useMemo(
    () =>
      [...priorityOptions].sort((a, b) =>
        collator.compare(String(a?.name ?? a?.code ?? ''), String(b?.name ?? b?.code ?? ''))
      ),
    [priorityOptions]
  );

  return (
    <Box
      component="form"
      onSubmit={onCreateRequest}
      sx={{
        border: framed ? '1px solid' : 'none',
        borderColor: framed ? 'divider' : undefined,
        borderRadius: framed ? 2 : 0,
        p: framed ? 2.5 : 0,
        backgroundColor: framed ? 'background.paper' : 'transparent',
      }}
    >
      <Stack spacing={1.5}>
        {!hideHeading && (
          <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
            {t('portalRequests.create.heading')}
          </Typography>
        )}
        {showOnBehalfTenantHint ? (
          <Alert severity="info" sx={{ py: 0.5 }}>
            {t('portalRequests.create.onBehalfIntro')}
          </Alert>
        ) : null}
        <StatusAlertSlot message={lookupsStatusMessage} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField
            label={t('portalRequests.create.propertyStreet')}
            value={tenantDefaults?.property_address || t('portalRequests.create.notAvailable')}
            InputProps={{ readOnly: true }}
            fullWidth
          />
          <TextField
            label={t('portalRequests.create.leaseEndDate')}
            value={
              tenantDefaults?.lease_end_date
                ? tenantDefaults.lease_end_date
                : tenantDefaults?.month_to_month
                  ? t('portalRequests.create.leaseEndDateMonthToMonth')
                  : t('portalRequests.create.leaseEndDateNotSet')
            }
            InputProps={{ readOnly: true }}
            fullWidth
          />
        </Stack>
        <TextField
          label={t('portalRequests.create.categoryCode')}
          value={tenantForm.category_code}
          onChange={onTenantField('category_code')}
          select
          required
          disabled={disabled || lookupsUnavailable}
        >
          {sortedCategoryOptions.map((option) => (
            <MenuItem key={option.code} value={option.code}>
              {option.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t('portalRequests.create.priorityCode')}
          value={tenantForm.priority_code}
          onChange={onTenantField('priority_code')}
          select
          required
          disabled={disabled || lookupsUnavailable}
        >
          {sortedPriorityOptions.map((option) => (
            <MenuItem key={option.code} value={option.code}>
              {option.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t('portalRequests.create.titleLabel')}
          value={tenantForm.title}
          onChange={onTenantField('title')}
          required
          disabled={disabled}
        />
        <TextField
          label={t('portalRequests.create.descriptionLabel')}
          value={tenantForm.description}
          onChange={onTenantField('description')}
          required
          multiline
          minRows={3}
          disabled={disabled}
        />
        <Tooltip
          title={
            !allowAttachments
              ? (showOnBehalfTenantHint || attachmentsFreeTierLocked
                ? t('portalSubscription.freeTier.attachmentsDisabled')
                : t('portalSubscription.freeTier.featureDisabled'))
              : ''
          }
        >
          <Box
            component="span"
            sx={{
              display: 'block',
              ...(!allowAttachments && (attachmentsFreeTierLocked || showOnBehalfTenantHint) && {
                cursor: 'not-allowed',
              }),
            }}
          >
            <Stack
              spacing={0.75}
              sx={{
                opacity: allowAttachments ? 1 : 0.72,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('portalRequests.create.attachmentsLabel')}
              </Typography>
              <AttachmentUploadControl
            instructions={t('portalRequests.attachments.instructions')}
            isDropActive={allowAttachments && isDropActive}
            onDragOver={(event) => {
              if (!allowAttachments) return;
              event.preventDefault();
              setIsDropActive(true);
            }}
            onDragLeave={() => setIsDropActive(false)}
            onDrop={(event) => {
              if (!allowAttachments) return;
              event.preventDefault();
              setIsDropActive(false);
              const files = event.dataTransfer?.files;
              if (files && files.length > 0) {
                onCreateAttachmentChange({ target: { files } });
              }
            }}
            chooseButtonLabel={t('portalRequests.actions.chooseFile')}
            multiple
            accept="image/*,video/*"
            onFileChange={allowAttachments ? onCreateAttachmentChange : () => {}}
            chooseDisabled={disabled || !allowAttachments}
            selectedContent={createAttachmentFiles && createAttachmentFiles.length > 0 ? (
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                {createAttachmentFiles.map((file, index) => (
                  <Stack
                    key={`${file.name}-${index}`}
                    direction="row"
                    alignItems="center"
                    spacing={0.75}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5, minWidth: 0 }}
                  >
                    <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t('portalRequests.attachments.selectedFileLabel')}: {file.name}
                    </Typography>
                    <Tooltip title={t('portalRequests.create.removeAttachment')}>
                      <IconButton
                        type="button"
                        size="small"
                        onClick={() => onRemoveCreateAttachment(index)}
                        aria-label={t('portalRequests.create.removeAttachment')}
                        disabled={disabled || !allowAttachments}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            ) : null}
              />
            </Stack>
          </Box>
        </Tooltip>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ flexWrap: 'wrap', rowGap: 1 }}
        >
          <InlineActionStatus message={createStatusMessage} />
          <Stack direction="row" spacing={1}>
            <Button type="button" variant="text" onClick={onCancel} disabled={disabled}>
              {t('portalRequests.actions.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={disabled || lookupsUnavailable}>
              {tenantCreateStatus === 'saving'
                ? t('portalRequests.actions.saving')
                : t('portalRequests.actions.create')}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
};

export default TenantRequestForm;

