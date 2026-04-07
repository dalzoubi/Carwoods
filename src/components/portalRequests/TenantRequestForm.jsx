import React from 'react';
import { Box, Button, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';

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
  disabled,
}) => {
  const { t } = useTranslation();
  const mailSubject = encodeURIComponent('Issues creating a maintenance request via carwoods.com');
  const contactHref = lookupContact?.email
    ? `mailto:${lookupContact.email}?subject=${mailSubject}`
    : '';
  const createStatusMessage = tenantCreateStatus === 'error'
    ? { severity: 'error', text: tenantCreateError || t('portalRequests.errors.saveFailed') }
    : tenantCreateStatus === 'success'
      ? { severity: 'success', text: t('portalRequests.create.saved') }
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
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2.5,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
          {t('portalRequests.create.heading')}
        </Typography>
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
        <StatusAlertSlot message={createStatusMessage} />
        <Stack direction="row" justifyContent="flex-end">
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

