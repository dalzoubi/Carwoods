import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants';
import {
  fetchLandlordProperties,
  fetchNotificationPolicies,
  fetchRequests,
  patchNotificationPolicy,
} from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';
import PortalPersonWithAvatar from './PortalPersonWithAvatar';
import { allowsSmsChannel, landlordTierLimits } from '../portalTierUtils';

const CHANNEL_OPTIONS = ['inherit', 'enabled', 'disabled'];

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function asNullableBoolean(value) {
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  return null;
}

function propertyAddressLabel(property) {
  if (!property || typeof property !== 'object') return '';
  const street = String(property.street ?? property.address_line ?? property.addressLine ?? '').trim();
  const city = String(property.city ?? '').trim();
  const state = String(property.state ?? '').trim();
  const zip = String(property.zip ?? '').trim();
  const name = String(property.name ?? '').trim();
  const locality = [city, state].filter(Boolean).join(', ');
  const address = [street, locality, zip].filter(Boolean).join(' ');
  return address || name;
}

function splitNameForInitials(displayName) {
  const parts = String(displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function roleColor(role) {
  const normalized = normalizeRole(role);
  if (normalized === Role.ADMIN) return 'secondary';
  if (normalized === Role.LANDLORD) return 'primary';
  if (normalized === Role.TENANT) return 'default';
  return 'default';
}

function readRequestScopeUserRows(scopeType, scopeId, requests) {
  if (!scopeId) return [];
  if (scopeType === 'REQUEST') {
    return requests.filter((row) => String(row?.id ?? '').trim() === scopeId);
  }
  return requests.filter((row) => String(row?.property_id ?? '').trim() === scopeId);
}

const PortalNotificationPolicies = () => {
  const { t } = useTranslation();
  const { baseUrl, isAuthenticated, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isLandlordViewer = role === Role.LANDLORD;
  const canUseModule = isAuthenticated && Boolean(baseUrl) && (role === Role.ADMIN || role === Role.LANDLORD);
  const landlordLimits = useMemo(() => landlordTierLimits(meData), [meData]);
  const smsPolicyFieldsEnabled = role === Role.ADMIN || allowsSmsChannel(landlordLimits);

  const [status, setStatus] = useState('idle');
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [scopeUsers, setScopeUsers] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [scopeType, setScopeType] = useState('PROPERTY');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [eventCategory, setEventCategory] = useState('MAINTENANCE');
  const [emailMode, setEmailMode] = useState('inherit');
  const [inAppMode, setInAppMode] = useState('inherit');
  const [smsMode, setSmsMode] = useState('inherit');
  const [smsOptInMode, setSmsOptInMode] = useState('inherit');
  const [active, setActive] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const scopeId = scopeType === 'PROPERTY' ? selectedPropertyId : selectedRequestId;
  const canSave = Boolean(scopeId && targetUserId.trim() && overrideReason.trim() && canUseModule);

  const requestOptions = useMemo(
    () =>
      requests.map((row) => ({
        id: row.id,
        label: `${row.title || t('portalRequests.list.untitled')} (${row.id.slice(0, 8)})`,
      })).sort((a, b) => collator.compare(a.label, b.label)),
    [requests, t]
  );

  const roleLabel = useCallback((rawRole) => {
    const normalized = normalizeRole(rawRole);
    if (normalized === Role.ADMIN) return t('portalHeader.roles.admin');
    if (normalized === Role.LANDLORD) return t('portalHeader.roles.landlord');
    if (normalized === Role.TENANT) return t('portalHeader.roles.tenant');
    return t('portalHeader.roles.unknown');
  }, [t]);

  const propertyOptions = useMemo(
    () => properties.map((property) => {
      const fallback = String(property?.id ?? '');
      return {
        id: fallback,
        label: propertyAddressLabel(property) || fallback,
      };
    }).sort((a, b) => collator.compare(a.label, b.label)),
    [properties]
  );

  const fallbackUsers = useMemo(() => {
    const byId = new Map();
    const scopeRows = readRequestScopeUserRows(scopeType, scopeId, requests);
    scopeRows.forEach((row) => {
      const submittedByUserId = String(row?.submitted_by_user_id ?? '').trim();
      if (!submittedByUserId) return;
      const submittedRole = normalizeRole(row?.submitted_by_role);
      if (isLandlordViewer && submittedRole !== Role.TENANT) return;
      const submittedByName = String(row?.submitted_by_display_name ?? '').trim() || submittedByUserId;
      byId.set(submittedByUserId, {
        id: submittedByUserId,
        displayName: submittedByName,
        role: submittedRole,
        profile_photo_url: String(row?.submitted_by_profile_photo_url ?? '').trim(),
        first_name: String(row?.submitted_by_first_name ?? ''),
        last_name: String(row?.submitted_by_last_name ?? ''),
      });
    });

    if (!isLandlordViewer) {
      const scopePropertyId = scopeType === 'PROPERTY'
        ? scopeId
        : String(scopeRows[0]?.property_id ?? '').trim();
      const property = properties.find((row) => String(row?.id ?? '').trim() === scopePropertyId);
      const landlordUserId = String(property?.landlord_user_id ?? property?.created_by ?? '').trim();
      const landlordName = String(property?.landlord_name ?? '').trim();
      if (landlordUserId) {
        const split = splitNameForInitials(landlordName || landlordUserId);
        byId.set(landlordUserId, {
          id: landlordUserId,
          displayName: landlordName || landlordUserId,
          role: Role.LANDLORD,
          profile_photo_url: '',
          first_name: split.first,
          last_name: split.last,
        });
      }
    }
    return Array.from(byId.values());
  }, [isLandlordViewer, properties, requests, scopeId, scopeType]);

  const userOptionMap = useMemo(() => {
    const byId = new Map();
    scopeUsers.forEach((user) => {
      if (!user || typeof user !== 'object') return;
      const id = String(user.user_id ?? '').trim();
      if (!id) return;
      const normalizedRole = normalizeRole(user.role);
      if (isLandlordViewer && normalizedRole !== Role.TENANT) return;
      const displayName = String(user.display_name ?? '').trim() || id;
      byId.set(id, {
        id,
        displayName,
        role: normalizedRole,
        profile_photo_url: String(user.profile_photo_url ?? '').trim(),
        first_name: String(user.first_name ?? ''),
        last_name: String(user.last_name ?? ''),
      });
    });
    if (byId.size === 0) {
      fallbackUsers.forEach((user) => {
        const id = String(user?.id ?? '').trim();
        if (!id) return;
        byId.set(id, {
          id,
          displayName: String(user.displayName ?? '').trim() || id,
          role: normalizeRole(user.role),
          profile_photo_url: String(user.profile_photo_url ?? '').trim(),
          first_name: String(user.first_name ?? ''),
          last_name: String(user.last_name ?? ''),
        });
      });
    }
    if (!isLandlordViewer) {
      policies.forEach((policy) => {
        const id = String(policy?.user_id ?? '').trim();
        if (!id || byId.has(id)) return;
        const split = splitNameForInitials(id);
        byId.set(id, {
          id,
          displayName: id,
          role: '',
          profile_photo_url: '',
          first_name: split.first,
          last_name: split.last,
        });
      });
    }
    return byId;
  }, [fallbackUsers, isLandlordViewer, policies, scopeUsers]);

  const userOptions = useMemo(
    () =>
      Array.from(userOptionMap.values()).sort((a, b) => {
        const byName = collator.compare(a.displayName, b.displayName);
        if (byName !== 0) return byName;
        return collator.compare(a.id, b.id);
      }),
    [userOptionMap]
  );

  const sortedPolicies = useMemo(
    () =>
      [...policies].sort((a, b) => {
        const aName = userOptionMap.get(a.user_id)?.displayName || a.user_id || '';
        const bName = userOptionMap.get(b.user_id)?.displayName || b.user_id || '';
        const byUser = collator.compare(aName, bName);
        if (byUser !== 0) return byUser;
        return collator.compare(String(a.event_category ?? ''), String(b.event_category ?? ''));
      }),
    [policies, userOptionMap]
  );

  useEffect(() => {
    if (!userOptions.length) {
      setTargetUserId('');
      return;
    }
    const hasCurrent = userOptions.some((option) => option.id === targetUserId);
    if (!hasCurrent) {
      setTargetUserId(userOptions[0].id);
    }
  }, [targetUserId, userOptions]);

  useEffect(() => {
    if (!requestOptions.length) {
      setSelectedRequestId('');
      return;
    }
    const hasCurrent = requestOptions.some((option) => option.id === selectedRequestId);
    if (!hasCurrent) {
      setSelectedRequestId(requestOptions[0].id);
    }
  }, [requestOptions, selectedRequestId]);

  const loadScopeData = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const [propertiesPayload, requestsPayload] = await Promise.all([
        fetchLandlordProperties(baseUrl, token, { emailHint }),
        fetchRequests(baseUrl, token, { path: '/api/portal/requests', emailHint }),
      ]);
      const propertyRows = Array.isArray(propertiesPayload?.properties)
        ? propertiesPayload.properties
        : [];
      const allRequestRows = Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [];
      const ownedPropertyIds = new Set(
        propertyRows
          .map((row) => String(row?.id ?? '').trim())
          .filter(Boolean)
      );
      const requestRows = role === Role.LANDLORD
        ? allRequestRows.filter((row) => ownedPropertyIds.has(String(row?.property_id ?? '').trim()))
        : allRequestRows;
      console.info('[PortalNotificationPolicies] scope data loaded', {
        role,
        propertiesCount: propertyRows.length,
        requestsCount: requestRows.length,
      });
      setProperties(propertyRows);
      setRequests(requestRows);
      setSelectedPropertyId((prev) => prev || propertyRows[0]?.id || '');
      setSelectedRequestId((prev) => prev || requestRows[0]?.id || '');
      setStatus('ok');
    } catch (loadError) {
      console.error('[PortalNotificationPolicies] failed to load scope data', loadError);
      handleApiForbidden(loadError);
      setError(t('portalNotificationPolicies.errors.loadFailed'));
      setStatus('error');
    }
  }, [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden, role, t]);

  const loadPolicies = useCallback(async () => {
    if (!canUseModule || !baseUrl || !scopeId) {
      setPolicies([]);
      setScopeUsers([]);
      return;
    }
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchNotificationPolicies(baseUrl, token, {
        emailHint,
        scopeType,
        scopeId,
      });
      setPolicies(Array.isArray(payload?.policies) ? payload.policies : []);
      setScopeUsers(Array.isArray(payload?.users) ? payload.users : []);
      console.info('[PortalNotificationPolicies] policy scope users loaded', {
        scopeType,
        scopeId,
        policiesCount: Array.isArray(payload?.policies) ? payload.policies.length : 0,
        apiUsersCount: Array.isArray(payload?.users) ? payload.users.length : 0,
      });
    } catch (loadError) {
      console.error('[PortalNotificationPolicies] failed to load policies/users', {
        scopeType,
        scopeId,
        loadError,
      });
      handleApiForbidden(loadError);
      setError(t('portalNotificationPolicies.errors.loadPoliciesFailed'));
    }
  }, [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden, scopeId, scopeType, t]);

  useEffect(() => {
    void loadScopeData();
  }, [loadScopeData]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const onSave = async () => {
    if (!canSave || !baseUrl) return;
    setSaveStatus('saving');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchNotificationPolicy(baseUrl, token, {
        emailHint,
        scope_type: scopeType,
        scope_id: scopeId,
        user_id: targetUserId.trim(),
        event_category: eventCategory,
        email_enabled: asNullableBoolean(emailMode),
        in_app_enabled: asNullableBoolean(inAppMode),
        sms_enabled: asNullableBoolean(smsMode),
        sms_opt_in: asNullableBoolean(smsOptInMode),
        active,
        override_reason: overrideReason.trim(),
      });
      setSaveStatus('ok');
      showFeedback(t('portalNotificationPolicies.messages.saved'));
      setOverrideReason('');
      await loadPolicies();
    } catch (saveError) {
      handleApiForbidden(saveError);
      setSaveStatus('error');
      setError(t('portalNotificationPolicies.errors.saveFailed'));
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalNotificationPolicies.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalNotificationPolicies.intro')}</Typography>
        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalNotificationPolicies.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalNotificationPolicies.errors.signInRequired') } : null}
        />
        <StatusAlertSlot
          message={error ? { severity: 'error', text: error } : null}
        />

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
              <Typography variant="h6">{t('portalNotificationPolicies.scope.heading')}</Typography>
              <PortalRefreshButton
                label={t('portalNotificationPolicies.actions.refresh')}
                onClick={() => {
                  void loadScopeData();
                  void loadPolicies();
                }}
                disabled={!canUseModule}
                loading={status === 'loading'}
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label={t('portalNotificationPolicies.scope.scopeType')}
                value={scopeType}
                onChange={(event) => setScopeType(event.target.value)}
                fullWidth
                disabled={!canUseModule || status === 'loading'}
              >
                <MenuItem value="PROPERTY">{t('portalNotificationPolicies.scope.property')}</MenuItem>
                <MenuItem value="REQUEST">{t('portalNotificationPolicies.scope.request')}</MenuItem>
              </TextField>

              {scopeType === 'PROPERTY' ? (
                <TextField
                  select
                  label={t('portalNotificationPolicies.scope.selectProperty')}
                  value={selectedPropertyId}
                  onChange={(event) => setSelectedPropertyId(event.target.value)}
                  fullWidth
                  disabled={!canUseModule || status === 'loading' || properties.length === 0}
                >
                  {propertyOptions.map((property) => (
                    <MenuItem key={property.id} value={property.id}>
                      {property.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  select
                  label={t('portalNotificationPolicies.scope.selectRequest')}
                  value={selectedRequestId}
                  onChange={(event) => setSelectedRequestId(event.target.value)}
                  fullWidth
                  disabled={!canUseModule || status === 'loading' || requestOptions.length === 0}
                >
                  {requestOptions.map((request) => (
                    <MenuItem key={request.id} value={request.id}>
                      {request.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              {t('portalNotificationPolicies.scope.currentScope', { scopeId: scopeId || '-' })}
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="h6">{t('portalNotificationPolicies.overrides.heading')}</Typography>
            {sortedPolicies.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('portalNotificationPolicies.overrides.empty')}
              </Typography>
            ) : sortedPolicies.map((policy) => (
              <Stack
                key={policy.id}
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}
              >
                <Box sx={{ minWidth: 220, maxWidth: '100%' }}>
                  <PortalPersonWithAvatar
                    photoUrl={String(userOptionMap.get(policy.user_id)?.profile_photo_url ?? '').trim()}
                    firstName={String(userOptionMap.get(policy.user_id)?.first_name ?? '')}
                    lastName={String(userOptionMap.get(policy.user_id)?.last_name ?? '')}
                    size={28}
                    alignItems="center"
                  >
                    <Typography variant="body2">
                      {t('portalNotificationPolicies.overrides.user')}:{' '}
                      {userOptionMap.get(policy.user_id)?.displayName || policy.user_id}
                    </Typography>
                  </PortalPersonWithAvatar>
                </Box>
                <Chip size="small" label={`${t('portalNotificationPolicies.form.eventCategory')}: ${policy.event_category}`} />
                <Chip
                  size="small"
                  color={roleColor(userOptionMap.get(policy.user_id)?.role)}
                  label={roleLabel(userOptionMap.get(policy.user_id)?.role)}
                />
                <Chip size="small" label={`Email: ${String(policy.email_enabled)}`} />
                <Chip size="small" label={`In-app: ${String(policy.in_app_enabled)}`} />
                <Chip size="small" label={`SMS: ${String(policy.sms_enabled)}`} />
                <Chip size="small" label={`SMS opt-in: ${String(policy.sms_opt_in)}`} />
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="h6">{t('portalNotificationPolicies.form.heading')}</Typography>
            <TextField
              select
              label={t('portalNotificationPolicies.form.userId')}
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              disabled={!canUseModule || userOptions.length === 0}
              fullWidth
            >
              {userOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  <PortalPersonWithAvatar
                    photoUrl={String(option.profile_photo_url ?? '').trim()}
                    firstName={option.first_name ?? ''}
                    lastName={option.last_name ?? ''}
                    size={28}
                    alignItems="center"
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', flexWrap: 'wrap' }}>
                      <Typography variant="body2">{option.displayName}</Typography>
                      <Chip
                        size="small"
                        color={roleColor(option.role)}
                        label={roleLabel(option.role)}
                      />
                    </Stack>
                  </PortalPersonWithAvatar>
                </MenuItem>
              ))}
            </TextField>
            {userOptions.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('portalNotificationPolicies.form.userOptionsEmpty')}
              </Typography>
            )}
            <TextField
              select
              label={t('portalNotificationPolicies.form.eventCategory')}
              value={eventCategory}
              onChange={(event) => setEventCategory(event.target.value)}
              fullWidth
              disabled={!canUseModule}
            >
              <MenuItem value="ONBOARDING">ONBOARDING</MenuItem>
              <MenuItem value="MAINTENANCE">MAINTENANCE</MenuItem>
              <MenuItem value="SECURITY_COMPLIANCE">SECURITY_COMPLIANCE</MenuItem>
            </TextField>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label={t('portalNotificationPolicies.form.email')}
                value={emailMode}
                onChange={(event) => setEmailMode(event.target.value)}
                fullWidth
                disabled={!canUseModule}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>{t(`portalNotificationPolicies.form.mode.${option}`)}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('portalNotificationPolicies.form.inApp')}
                value={inAppMode}
                onChange={(event) => setInAppMode(event.target.value)}
                fullWidth
                disabled={!canUseModule}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>{t(`portalNotificationPolicies.form.mode.${option}`)}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Tooltip
              title={!smsPolicyFieldsEnabled ? t('portalSubscription.freeTier.featureDisabled') : ''}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label={t('portalNotificationPolicies.form.sms')}
                  value={smsMode}
                  onChange={(event) => setSmsMode(event.target.value)}
                  fullWidth
                  disabled={!canUseModule || !smsPolicyFieldsEnabled}
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{t(`portalNotificationPolicies.form.mode.${option}`)}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={t('portalNotificationPolicies.form.smsOptIn')}
                  value={smsOptInMode}
                  onChange={(event) => setSmsOptInMode(event.target.value)}
                  fullWidth
                  disabled={!canUseModule || !smsPolicyFieldsEnabled}
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{t(`portalNotificationPolicies.form.mode.${option}`)}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Tooltip>
            <TextField
              select
              label={t('portalNotificationPolicies.form.active')}
              value={active ? 'true' : 'false'}
              onChange={(event) => setActive(event.target.value === 'true')}
              fullWidth
              disabled={!canUseModule}
            >
              <MenuItem value="true">{t('portalNotificationPolicies.form.activeEnabled')}</MenuItem>
              <MenuItem value="false">{t('portalNotificationPolicies.form.activeDisabled')}</MenuItem>
            </TextField>
            <TextField
              label={t('portalNotificationPolicies.form.overrideReason')}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              fullWidth
              multiline
              minRows={2}
              disabled={!canUseModule}
            />

            <Stack direction="row" justifyContent="flex-end">
              <Button
                type="button"
                variant="contained"
                onClick={() => { void onSave(); }}
                disabled={!canSave || saveStatus === 'saving'}
              >
                {saveStatus === 'saving'
                  ? t('portalNotificationPolicies.actions.saving')
                  : t('portalNotificationPolicies.actions.save')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalNotificationPolicies;
