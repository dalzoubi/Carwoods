import React from 'react';
import { Helmet } from 'react-helmet';
import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import PortalAdminAiConfig from './PortalAdminAiConfig';
import PortalAdminAiAgents from './PortalAdminAiAgents';
import PortalAdminAttachmentConfig from './PortalAdminAttachmentConfig';

const TAB_SLUGS = ['policies', 'agents', 'attachments'];

function tabIndexFromSlug(rawSlug) {
  const normalized = String(rawSlug || '').trim().toLowerCase();
  const index = TAB_SLUGS.indexOf(normalized);
  return index >= 0 ? index : 0;
}

const PortalAdminAiSettings = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabSlug = searchParams.get('tab');
  const tab = tabIndexFromSlug(tabSlug);

  const onTabChange = React.useCallback((_, nextTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', TAB_SLUGS[nextTab] || TAB_SLUGS[0]);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
            onChange={onTabChange}
            aria-label={t('portalAdminConfigurations.tabsLabel')}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label={t('portalAdminConfigurations.tabs.policies')} />
            <Tab label={t('portalAdminConfigurations.tabs.agents')} />
            <Tab label={t('portalAdminConfigurations.tabs.attachments')} />
          </Tabs>
        </Paper>
        {tab === 0 && <PortalAdminAiConfig />}
        {tab === 1 && <PortalAdminAiAgents />}
        {tab === 2 && <PortalAdminAttachmentConfig />}
      </Stack>
    </Box>
  );
};

export default PortalAdminAiSettings;
