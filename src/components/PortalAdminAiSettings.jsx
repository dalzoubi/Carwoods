import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants';
import PortalAdminAiConfig from './PortalAdminAiConfig';
import PortalAdminAiAgents from './PortalAdminAiAgents';
import PortalAdminAttachmentConfig from './PortalAdminAttachmentConfig';
import PortalNotificationPolicies from './PortalNotificationPolicies';

export const ONBOARDING_SETTINGS_VISITED_KEY = 'carwoods-onboarding-settings-visited';

function tabIndexFromSlug(rawSlug, tabSlugs) {
  const normalized = String(rawSlug || '').trim().toLowerCase();
  const index = tabSlugs.indexOf(normalized);
  return index >= 0 ? index : 0;
}

const PortalAdminAiSettings = () => {
  const { t } = useTranslation();
  const { account, meData } = usePortalAuth();

  useEffect(() => {
    localStorage.setItem(ONBOARDING_SETTINGS_VISITED_KEY, 'true');
  }, []);
  const role = normalizeRole(resolveRole(meData, account));
  const isLandlord = role === Role.LANDLORD;
  const tabSlugs = isLandlord
    ? ['notifications']
    : ['policies', 'agents', 'attachments', 'notifications'];
  const [searchParams, setSearchParams] = useSearchParams();
  const tabSlug = searchParams.get('tab');
  const tab = tabIndexFromSlug(tabSlug, tabSlugs);

  const onTabChange = React.useCallback((_, nextTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabSlugs[nextTab] || tabSlugs[0]);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, tabSlugs]);

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
            {!isLandlord && <Tab label={t('portalAdminConfigurations.tabs.policies')} />}
            {!isLandlord && <Tab label={t('portalAdminConfigurations.tabs.agents')} />}
            {!isLandlord && <Tab label={t('portalAdminConfigurations.tabs.attachments')} />}
            <Tab label={t('portalAdminConfigurations.tabs.notifications')} />
          </Tabs>
        </Paper>
        {tabSlugs[tab] === 'policies' && <PortalAdminAiConfig />}
        {tabSlugs[tab] === 'agents' && <PortalAdminAiAgents />}
        {tabSlugs[tab] === 'attachments' && <PortalAdminAttachmentConfig />}
        {tabSlugs[tab] === 'notifications' && <PortalNotificationPolicies />}
      </Stack>
    </Box>
  );
};

export default PortalAdminAiSettings;
