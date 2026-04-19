import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
  Divider,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import PortalConfigOptionHelp from './PortalConfigOptionHelp';

/**
 * Per-flow notification channel matrix for the profile page.
 *
 * Displays one row per flow with three channel switches (in-app, email, SMS)
 * and an info icon that opens the i18n-keyed help dialog.
 *
 * Props:
 *  - catalog: Array of flow descriptors from meData.user.notification_flow_catalog
 *  - overrides: Map<event_type_code, {email, in_app, sms}> — user's per-flow overrides
 *              (null/undefined channel = use default, true/false = explicit user choice)
 *  - globalPrefs: { email, in_app, sms } — the master toggles (greys out disabled channels)
 *  - smsAllowed: boolean — true when the tier permits SMS
 *  - smsOptedIn: boolean — true when the user has consented to SMS
 *  - disabled: boolean
 *  - onChange(eventTypeCode, channel, value) — value is true | false | null (null clears override)
 */
export default function PortalProfileFlowMatrix({
  catalog,
  overrides,
  globalPrefs,
  smsAllowed,
  smsOptedIn,
  disabled,
  onChange,
}) {
  const { t } = useTranslation();

  const groups = useMemo(() => {
    const byCategory = {
      ONBOARDING: [],
      MAINTENANCE: [],
      SECURITY_COMPLIANCE: [],
    };
    for (const entry of catalog ?? []) {
      const bucket = byCategory[entry.category] ?? byCategory.MAINTENANCE;
      bucket.push(entry);
    }
    return byCategory;
  }, [catalog]);

  const resolveChannelValue = (flow, channel) => {
    const ov = overrides?.[flow.event_type_code];
    const dflt = channel === 'email'
      ? flow.default_email
      : channel === 'in_app'
        ? flow.default_in_app
        : flow.default_sms;
    if (!ov) return dflt;
    const key = channel === 'email' ? 'email_enabled' : channel === 'in_app' ? 'in_app_enabled' : 'sms_enabled';
    const raw = ov[key];
    if (raw === null || raw === undefined) return dflt;
    return Boolean(raw);
  };

  const hasOverride = (flow, channel) => {
    const ov = overrides?.[flow.event_type_code];
    if (!ov) return false;
    const key = channel === 'email' ? 'email_enabled' : channel === 'in_app' ? 'in_app_enabled' : 'sms_enabled';
    return ov[key] !== null && ov[key] !== undefined;
  };

  const channelDisabled = (flow, channel) => {
    if (disabled) return true;
    if (!flow.user_overridable) return true;
    if (channel === 'sms' && (!smsAllowed || !smsOptedIn)) return true;
    if (channel === 'email' && !globalPrefs?.email) return true;
    if (channel === 'in_app' && !globalPrefs?.in_app) return true;
    if (channel === 'sms' && !globalPrefs?.sms) return true;
    return false;
  };

  const renderRow = (flow) => {
    const inAppValue = resolveChannelValue(flow, 'in_app');
    const emailValue = resolveChannelValue(flow, 'email');
    const smsValue = resolveChannelValue(flow, 'sms');

    return (
      <Stack
        key={flow.event_type_code}
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{
          py: 1,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          '&:last-of-type': { borderBottom: 'none' },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {t(flow.label_key)}
          </Typography>
          <PortalConfigOptionHelp labelKey={flow.label_key} bodyKey={flow.info_key} disabled={disabled} />
          {!flow.user_overridable && (
            <Chip
              size="small"
              label={t('portalProfile.flows.mandatoryBadge')}
              color="warning"
              variant="outlined"
              sx={{ ml: 0.5, height: 20, fontSize: 11 }}
            />
          )}
          {flow.quiet_hours_bypass && (
            <Tooltip title={t('portalProfile.flows.bypassQuietHoursTooltip')}>
              <Chip
                size="small"
                label={t('portalProfile.flows.bypassQuietHoursBadge')}
                color="info"
                variant="outlined"
                sx={{ ml: 0.5, height: 20, fontSize: 11 }}
              />
            </Tooltip>
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <ChannelSwitch
            label={t('portalProfile.flows.channel.inApp')}
            checked={inAppValue}
            overridden={hasOverride(flow, 'in_app')}
            disabled={channelDisabled(flow, 'in_app')}
            onChange={(val) => onChange?.(flow.event_type_code, 'in_app', val)}
            flow={flow}
          />
          <ChannelSwitch
            label={t('portalProfile.flows.channel.email')}
            checked={emailValue}
            overridden={hasOverride(flow, 'email')}
            disabled={channelDisabled(flow, 'email')}
            onChange={(val) => onChange?.(flow.event_type_code, 'email', val)}
            flow={flow}
          />
          <ChannelSwitch
            label={t('portalProfile.flows.channel.sms')}
            checked={smsValue}
            overridden={hasOverride(flow, 'sms')}
            disabled={channelDisabled(flow, 'sms')}
            onChange={(val) => onChange?.(flow.event_type_code, 'sms', val)}
            flow={flow}
          />
        </Stack>
      </Stack>
    );
  };

  const renderGroup = (titleKey, flows) => {
    if (!flows?.length) return null;
    return (
      <Box key={titleKey}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
          {t(titleKey)}
        </Typography>
        <Box sx={{ mt: 0.5 }}>{flows.map(renderRow)}</Box>
      </Box>
    );
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" color="text.secondary">
          {t('portalProfile.flows.heading')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('portalProfile.flows.legend')}
        </Typography>
      </Stack>
      <Divider />
      {renderGroup('portalProfile.flows.groups.onboarding', groups.ONBOARDING)}
      {renderGroup('portalProfile.flows.groups.maintenance', groups.MAINTENANCE)}
      {renderGroup('portalProfile.flows.groups.security', groups.SECURITY_COMPLIANCE)}
    </Stack>
  );
}

function ChannelSwitch({ label, checked, overridden, disabled, onChange }) {
  const { t } = useTranslation();
  return (
    <Tooltip
      title={overridden
        ? t('portalProfile.flows.overriddenTooltip', { channel: label })
        : t('portalProfile.flows.defaultTooltip', { channel: label })
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 }}>
        <Typography variant="caption" color={overridden ? 'primary.main' : 'text.secondary'}>
          {label}
        </Typography>
        <Switch
          size="small"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          onDoubleClick={() => onChange?.(null)}
          inputProps={{ 'aria-label': label }}
        />
      </Box>
    </Tooltip>
  );
}
