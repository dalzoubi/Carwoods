import React from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';

const TenantRequestForm = ({
  tenantForm,
  onTenantField,
  onCreateRequest,
  tenantCreateStatus,
  tenantCreateError,
  disabled,
}) => {
  const { t } = useTranslation();
  const createStatusMessage = tenantCreateStatus === 'error'
    ? { severity: 'error', text: tenantCreateError || t('portalRequests.errors.saveFailed') }
    : tenantCreateStatus === 'success'
      ? { severity: 'success', text: t('portalRequests.create.saved') }
      : null;

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
        <TextField
          label={t('portalRequests.create.propertyId')}
          value={tenantForm.property_id}
          onChange={onTenantField('property_id')}
          required
          disabled={disabled}
        />
        <TextField
          label={t('portalRequests.create.leaseId')}
          value={tenantForm.lease_id}
          onChange={onTenantField('lease_id')}
          required
          disabled={disabled}
        />
        <TextField
          label={t('portalRequests.create.categoryCode')}
          value={tenantForm.category_code}
          onChange={onTenantField('category_code')}
          required
          disabled={disabled}
        />
        <TextField
          label={t('portalRequests.create.priorityCode')}
          value={tenantForm.priority_code}
          onChange={onTenantField('priority_code')}
          required
          disabled={disabled}
        />
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
          <Button type="submit" variant="contained" disabled={disabled}>
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

