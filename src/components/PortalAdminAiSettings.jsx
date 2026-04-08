import React from 'react';
import { Helmet } from 'react-helmet';
import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PortalAdminAiConfig from './PortalAdminAiConfig';

const PortalAdminAiSettings = () => {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState(0);

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminConfigurations.title')}</title>
        <meta name="description" content={t('portalAdminConfigurations.metaDescription')} />
      </Helmet>
      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalAdminConfigurations.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalAdminConfigurations.intro')}</Typography>
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, nextTab) => setTab(nextTab)}
            aria-label={t('portalAdminConfigurations.tabsLabel')}
          >
            <Tab label={t('portalAdminConfigurations.tabs.ai')} />
          </Tabs>
        </Paper>
        {tab === 0 && <PortalAdminAiConfig />}
      </Stack>
    </Box>
  );
};

export default PortalAdminAiSettings;
