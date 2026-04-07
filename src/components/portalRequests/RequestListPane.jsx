import React, { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';
import { RequestStatus } from '../../domain/constants';

function statusColor(statusCode) {
  const normalized = String(statusCode || '').toUpperCase();
  if ([RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED, RequestStatus.OPEN].includes(normalized)) {
    return 'warning';
  }
  if (normalized === RequestStatus.IN_PROGRESS) return 'info';
  if ([RequestStatus.CANCELLED, RequestStatus.RESOLVED, RequestStatus.CLOSED].includes(normalized)) {
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
}) => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('all');
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((request) => {
      const statusCode = String(request.status_code || '').toUpperCase();
      if (statusFilter === 'open') {
        return [RequestStatus.NOT_STARTED, RequestStatus.ACKNOWLEDGED, RequestStatus.OPEN].includes(statusCode);
      }
      if (statusFilter === 'inProgress') return statusCode === RequestStatus.IN_PROGRESS;
      if (statusFilter === 'cancelled') return statusCode === RequestStatus.CANCELLED;
      if (statusFilter === 'resolved') return [RequestStatus.RESOLVED, RequestStatus.CLOSED].includes(statusCode);
      return true;
    });
  }, [requests, statusFilter]);
  const listStatusMessage = requestsStatus === 'loading'
    ? { severity: 'info', text: t('portalRequests.loading') }
    : requestsStatus === 'error'
      ? { severity: 'error', text: requestsError || t('portalRequests.errors.loadFailed') }
      : requestsStatus === 'ok' && filteredRequests.length === 0
        ? { severity: 'info', text: t('portalRequests.list.empty') }
        : null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
          {t('portalRequests.list.heading')}
        </Typography>
        <Tooltip title={t('portalRequests.actions.reload')}>
          <span>
            <IconButton
              type="button"
              size="small"
              onClick={onReload}
              disabled={reloadDisabled}
              aria-label={t('portalRequests.actions.reload')}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <StatusAlertSlot message={listStatusMessage} />
      <ToggleButtonGroup
        size="small"
        exclusive
        value={statusFilter}
        onChange={(_, nextValue) => {
          if (nextValue) setStatusFilter(nextValue);
        }}
      >
        <ToggleButton value="all">{t('portalRequests.list.filters.all')}</ToggleButton>
        <ToggleButton value="open">{t('portalRequests.list.filters.open')}</ToggleButton>
        <ToggleButton value="inProgress">{t('portalRequests.list.filters.inProgress')}</ToggleButton>
        <ToggleButton value="cancelled">{t('portalRequests.list.filters.cancelled')}</ToggleButton>
        <ToggleButton value="resolved">{t('portalRequests.list.filters.resolved')}</ToggleButton>
      </ToggleButtonGroup>

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

