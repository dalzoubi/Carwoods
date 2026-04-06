import React from 'react';
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import StatusAlertSlot from '../StatusAlertSlot';

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
  const listStatusMessage = requestsStatus === 'loading'
    ? { severity: 'info', text: t('portalRequests.loading') }
    : requestsStatus === 'error'
      ? { severity: 'error', text: requestsError || t('portalRequests.errors.loadFailed') }
      : requestsStatus === 'ok' && requests.length === 0
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

      {requests.length > 0 && (
        <Box sx={{ minWidth: { md: 320 }, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          <List dense disablePadding>
            {requests.map((item) => (
              <ListItemButton
                key={item.id}
                selected={selectedRequestId === item.id}
                onClick={() => onSelectRequest(item.id)}
              >
                <ListItemText
                  primary={item.title || t('portalRequests.list.untitled')}
                  secondary={`${t('portalRequests.labels.status')}: ${item.current_status_id || '-'}`}
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

