import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import { RequestStatus } from '../../domain/constants';

function statusColor(statusCode) {
  const normalized = String(statusCode || '').toUpperCase();
  if ([RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED].includes(normalized)) {
    return 'warning';
  }
  if (
    [RequestStatus.SCHEDULED, RequestStatus.WAITING_ON_TENANT, RequestStatus.WAITING_ON_VENDOR].includes(
      normalized
    )
  ) {
    return 'info';
  }
  if ([RequestStatus.CANCELLED, RequestStatus.COMPLETE].includes(normalized)) {
    return 'success';
  }
  return 'default';
}

const RequestListPane = ({
  requests,
  requestsStatus,
  requestsError,
  selectedRequestId,
  onSelectRequest,
  onReload,
  reloadDisabled,
  isAdmin = false,
  landlords = [],
  landlordsStatus = 'idle',
  selectedLandlordId = '',
  onSelectLandlord,
}) => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('all');
  const landlordFilteredRequests = useMemo(() => {
    if (!isAdmin || !selectedLandlordId) return requests;
    return requests.filter((request) => {
      const landlordUserId = [
        request.landlord_user_id,
        request.landlord_id,
        request.owner_user_id,
        request.created_by,
        request.created_by_user_id,
      ].find((value) => typeof value === 'string' && value.trim());
      return String(landlordUserId || '').trim() === selectedLandlordId;
    });
  }, [isAdmin, requests, selectedLandlordId]);
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return landlordFilteredRequests;
    return landlordFilteredRequests.filter((request) => {
      const statusCode = String(request.status_code || '').toUpperCase();
      return statusCode === statusFilter;
    });
  }, [landlordFilteredRequests, statusFilter]);
  const listStatusMessage = requestsStatus === 'loading'
    ? { severity: 'info', text: t('portalRequests.loading') }
    : requestsStatus === 'error'
      ? { severity: 'error', text: requestsError || t('portalRequests.errors.loadFailed') }
      : null;
  const emptyStatusMessage = requestsStatus === 'ok' && filteredRequests.length === 0
    ? { severity: 'info', text: t('portalRequests.list.empty') }
    : null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
          {t('portalRequests.list.heading')}
        </Typography>
        <Button
          type="button"
          size="small"
          variant="outlined"
          onClick={onReload}
          disabled={reloadDisabled}
          startIcon={requestsStatus === 'loading' ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
          sx={{ textTransform: 'none' }}
        >
          {t('portalRequests.actions.reload')}
        </Button>
      </Stack>
      <StatusAlertSlot message={listStatusMessage} />
      {isAdmin && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {t('portalRequests.list.landlordFilter.label')}
          </Typography>
          <Select
            size="small"
            value={selectedLandlordId}
            onChange={(event) => {
              onSelectLandlord?.(event.target.value);
            }}
            displayEmpty
            disabled={landlordsStatus === 'loading' || landlords.length === 0}
            sx={{ maxWidth: 320 }}
          >
            <MenuItem value="">{t('portalRequests.list.landlordFilter.all')}</MenuItem>
            {landlords.map((landlord) => {
              const first = String(landlord.first_name ?? '').trim();
              const last = String(landlord.last_name ?? '').trim();
              const name = `${first} ${last}`.trim() || String(landlord.email ?? '').trim();
              return (
                <MenuItem key={landlord.id} value={landlord.id}>
                  {name || t('portalRequests.list.landlordFilter.unknown')}
                </MenuItem>
              );
            })}
          </Select>
        </Stack>
      )}
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {t('portalRequests.labels.status')}
        </Typography>
        <Select
          size="small"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
          }}
          sx={{ maxWidth: 260 }}
        >
          <MenuItem value="all">{t('portalRequests.list.filters.all')}</MenuItem>
          <MenuItem value={RequestStatus.NOT_STARTED}>{t('portalRequests.statuses.NOT_STARTED')}</MenuItem>
          <MenuItem value={RequestStatus.ACKNOWLEDGED}>{t('portalRequests.statuses.ACKNOWLEDGED')}</MenuItem>
          <MenuItem value={RequestStatus.SCHEDULED}>{t('portalRequests.statuses.SCHEDULED')}</MenuItem>
          <MenuItem value={RequestStatus.WAITING_ON_TENANT}>{t('portalRequests.statuses.WAITING_ON_TENANT')}</MenuItem>
          <MenuItem value={RequestStatus.WAITING_ON_VENDOR}>{t('portalRequests.statuses.WAITING_ON_VENDOR')}</MenuItem>
          <MenuItem value={RequestStatus.COMPLETE}>{t('portalRequests.statuses.COMPLETE')}</MenuItem>
          <MenuItem value={RequestStatus.CANCELLED}>{t('portalRequests.statuses.CANCELLED')}</MenuItem>
        </Select>
      </Stack>
      <StatusAlertSlot message={emptyStatusMessage} />

      {filteredRequests.length > 0 && (
        <Box sx={{ minWidth: { md: 320 }, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          <List dense disablePadding>
            {filteredRequests.map((item) => (
              <ListItemButton
                key={item.id}
                selected={selectedRequestId === item.id}
                onClick={() => onSelectRequest(item.id)}
              >
                <ListItemText
                  primary={item.title || t('portalRequests.list.untitled')}
                  secondary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        {t('portalRequests.labels.status')}:
                      </Typography>
                      <Chip
                        size="small"
                        label={item.status_name || item.status_code || '-'}
                        color={statusColor(item.status_code)}
                        variant="outlined"
                      />
                    </Stack>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </Stack>
  );
};

export default RequestListPane;

