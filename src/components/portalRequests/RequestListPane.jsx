import React from 'react';
import { Alert, Box, Button, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

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

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
          {t('portalRequests.list.heading')}
        </Typography>
        <Button type="button" variant="outlined" onClick={onReload} disabled={reloadDisabled}>
          {t('portalRequests.actions.reload')}
        </Button>
      </Stack>
      {requestsStatus === 'loading' && <Alert severity="info">{t('portalRequests.loading')}</Alert>}
      {requestsStatus === 'error' && (
        <Alert severity="error">{requestsError || t('portalRequests.errors.loadFailed')}</Alert>
      )}
      {requestsStatus === 'ok' && requests.length === 0 && (
        <Alert severity="info">{t('portalRequests.list.empty')}</Alert>
      )}

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

