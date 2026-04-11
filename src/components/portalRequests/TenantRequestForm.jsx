import React from 'react';
import { Box, Button, IconButton, Link, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import InlineActionStatus from '../InlineActionStatus';

const TenantRequestForm = ({
  tenantForm,
  tenantDefaults,
  categoryOptions,
  priorityOptions,
  lookupsStatus,
  lookupsError,
  lookupContact,
  onTenantField,
  onCreateRequest,
  tenantCreateStatus,
  tenantCreateError,
  createAttachmentFiles,
  onCreateAttachmentChange,
  onRemoveCreateAttachment,
  disabled,
  hideHeading = false,
  framed = true,
}) => {
  const { t } = useTranslation();
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
  const lookupsUnavailable = lookupsStatus !== 'ok' || categoryOptions.length === 0 || priorityOptions.length === 0;

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
          {categoryOptions.map((option) => (
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
          {priorityOptions.map((option) => (
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
        <Stack spacing={0.75}>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.create.attachmentsLabel')}
          </Typography>
          {createAttachmentFiles && createAttachmentFiles.length > 0 && (
            <Stack spacing={0.5}>
              {createAttachmentFiles.map((file, index) => (
                <Stack key={index} direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </Typography>
                  <Tooltip title={t('portalRequests.create.removeAttachment')}>
                    <IconButton
                      type="button"
                      size="small"
                      onClick={() => onRemoveCreateAttachment(index)}
                      aria-label={t('portalRequests.create.removeAttachment')}
                      disabled={disabled}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
            <Button variant="outlined" component="label" type="button" disabled={disabled} size="small">
              {t('portalRequests.actions.chooseFile')}
              <input type="file" hidden multiple accept="image/*,video/*" onChange={onCreateAttachmentChange} />
            </Button>
            <Typography variant="caption" color="text.secondary">
              {t('portalRequests.attachments.instructions')}
            </Typography>
          </Stack>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ flexWrap: 'wrap', rowGap: 1 }}
        >
          <InlineActionStatus message={createStatusMessage} />
          <Button type="submit" variant="contained" disabled={disabled || lookupsUnavailable}>
            {tenantCreateStatus === 'saving'
              ? t('portalRequests.actions.saving')
              : t('portalRequests.actions.create')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default TenantRequestForm;

