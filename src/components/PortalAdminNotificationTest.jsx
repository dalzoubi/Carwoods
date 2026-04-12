import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { fetchAdminPortalUsers, postAdminNotificationTest } from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import StatusAlertSlot from './StatusAlertSlot';

function errorMessageFromCode(t, code) {
  const key = `portalAdminNotificationTest.errors.${code}`;
  const translated = t(key);
  return translated === key ? t('portalAdminNotificationTest.errors.unknown') : translated;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function userDisplayName(userRow) {
  const first = String(userRow?.first_name ?? '').trim();
  const last = String(userRow?.last_name ?? '').trim();
  const name = `${first} ${last}`.trim();
  return name || String(userRow?.email ?? '').trim() || '—';
}

function roleLabelForRecipient(t, role) {
  const r = String(role ?? '').trim().toUpperCase();
  if (r === Role.ADMIN) return t('portalHeader.roles.admin');
  if (r === Role.LANDLORD) return t('portalHeader.roles.landlord');
  if (r === Role.TENANT) return t('portalHeader.roles.tenant');
  return r || '—';
}

const PortalAdminNotificationTest = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
    handleApiForbidden,
  } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUse = isAuthenticated && isAdmin && Boolean(baseUrl);

  const defaultEmail = useMemo(() => emailFromAccount(account) ?? '', [account]);

  const [emailTo, setEmailTo] = useState('');
  const [emailTitle, setEmailTitle] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppBody, setInAppBody] = useState('');
  const [busy, setBusy] = useState(null);
  const [recipientUsers, setRecipientUsers] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [inAppRecipient, setInAppRecipient] = useState(null);

  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  React.useEffect(() => {
    if (defaultEmail && !emailTo) {
      setEmailTo(defaultEmail);
    }
  }, [defaultEmail, emailTo]);

  const loadRecipientUsers = useCallback(async () => {
    if (!canUse || !baseUrl) {
      setRecipientUsers([]);
      return;
    }
    setRecipientsLoading(true);
    try {
      const token = await getAccessToken();
      const payload = await fetchAdminPortalUsers(baseUrl, token, {
        includeInactive: true,
        emailHint: account?.username || undefined,
      });
      setRecipientUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (e) {
      handleApiForbidden?.(e);
      setRecipientUsers([]);
    } finally {
      setRecipientsLoading(false);
    }
  }, [account?.username, baseUrl, canUse, getAccessToken, handleApiForbidden]);

  useEffect(() => {
    void loadRecipientUsers();
  }, [loadRecipientUsers]);

  const inAppRecipientOptions = useMemo(() => {
    const portalUser = meData?.user;
    const uid = portalUser?.id;
    if (!uid) return [];
    const selfId = String(uid);
    let source = recipientUsers;
    if (!source.some((u) => String(u.id) === selfId)) {
      const role = meData?.role ?? Role.ADMIN;
      source = [
        {
          id: portalUser.id,
          email: portalUser.email ?? account?.username ?? '',
          first_name: portalUser.first_name,
          last_name: portalUser.last_name,
          role: typeof role === 'string' ? role : Role.ADMIN,
        },
        ...source,
      ];
    }
    const rows = source.map((u) => {
      const id = String(u.id);
      const isSelf = id === selfId;
      return {
        id,
        primaryLabel: isSelf
          ? t('portalAdminNotificationTest.inApp.recipientYou')
          : userDisplayName(u),
        secondaryLabel: `${String(u.email ?? '').trim() || '—'} · ${roleLabelForRecipient(t, u.role)}`,
      };
    });
    rows.sort((a, b) => {
      if (a.id === selfId) return -1;
      if (b.id === selfId) return 1;
      return collator.compare(a.primaryLabel, b.primaryLabel);
    });
    return rows;
  }, [account?.username, meData?.role, meData?.user, recipientUsers, t]);

  useEffect(() => {
    if (!inAppRecipientOptions.length) return;
    setInAppRecipient((prev) => {
      if (prev && inAppRecipientOptions.some((o) => o.id === prev.id)) return prev;
      return inAppRecipientOptions[0] ?? null;
    });
  }, [inAppRecipientOptions]);

  const runTest = async (channel, payload) => {
    if (!baseUrl) return;
    setBusy(channel);
    try {
      const token = await getAccessToken();
      const res = await postAdminNotificationTest(baseUrl, token, {
        emailHint: account?.username || undefined,
        channel,
        ...payload,
      });
      if (channel === 'in_app') {
        showFeedback(
          res?.notification_id
            ? t('portalAdminNotificationTest.success.inAppWithId', { id: res.notification_id })
            : t('portalAdminNotificationTest.success.inApp')
        );
      } else if (channel === 'email') {
        showFeedback(
          res?.delivery_id
            ? t('portalAdminNotificationTest.success.emailWithId', { id: res.delivery_id })
            : t('portalAdminNotificationTest.success.emailQueued')
        );
      } else {
        showFeedback(
          res?.delivery_id
            ? t('portalAdminNotificationTest.success.smsWithId', { id: res.delivery_id })
            : t('portalAdminNotificationTest.success.smsQueued')
        );
      }
    } catch (e) {
      handleApiForbidden?.(e);
      const code = e && typeof e === 'object' ? e.code : '';
      showFeedback(errorMessageFromCode(t, code || 'unknown'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminNotificationTest.metaTitle')}</title>
        <meta name="description" content={t('portalAdminNotificationTest.metaDescription')} />
      </Helmet>

      <Stack spacing={2}>
        <Typography variant="h5" component="h2">
          {t('portalAdminNotificationTest.heading')}
        </Typography>
        <Typography color="text.secondary">
          {t('portalAdminNotificationTest.intro')}
        </Typography>

        <StatusAlertSlot
          message={
            !canUse
              ? { severity: 'warning', text: t('portalAdminNotificationTest.notAvailable') }
              : null
          }
        />

        <Paper variant="outlined" sx={{ p: 2, backgroundImage: 'none' }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              {t('portalAdminNotificationTest.email.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalAdminNotificationTest.email.hint')}
            </Typography>
            <TextField
              label={t('portalAdminNotificationTest.email.toLabel')}
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              disabled={!canUse}
              fullWidth
              autoComplete="email"
            />
            <TextField
              label={t('portalAdminNotificationTest.fields.title')}
              value={emailTitle}
              onChange={(e) => setEmailTitle(e.target.value)}
              disabled={!canUse}
              fullWidth
            />
            <TextField
              label={t('portalAdminNotificationTest.fields.body')}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              disabled={!canUse}
              fullWidth
              multiline
              minRows={3}
            />
            <Box>
              <Button
                type="button"
                variant="contained"
                disabled={!canUse || busy === 'email'}
                onClick={() => {
                  void runTest('email', {
                    email: emailTo.trim(),
                    title: emailTitle.trim() || undefined,
                    body: emailBody.trim() || undefined,
                  });
                }}
              >
                {t('portalAdminNotificationTest.email.send')}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, backgroundImage: 'none' }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              {t('portalAdminNotificationTest.sms.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalAdminNotificationTest.sms.hint')}
            </Typography>
            <TextField
              label={t('portalAdminNotificationTest.sms.phoneLabel')}
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              disabled={!canUse}
              fullWidth
              placeholder="+15551234567"
            />
            <TextField
              label={t('portalAdminNotificationTest.fields.body')}
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              disabled={!canUse}
              fullWidth
              multiline
              minRows={2}
            />
            <Box>
              <Button
                type="button"
                variant="contained"
                disabled={!canUse || busy === 'sms'}
                onClick={() => {
                  void runTest('sms', {
                    phone: smsPhone.trim(),
                    body: smsBody.trim() || undefined,
                  });
                }}
              >
                {t('portalAdminNotificationTest.sms.send')}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, backgroundImage: 'none' }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              {t('portalAdminNotificationTest.inApp.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalAdminNotificationTest.inApp.hint')}
            </Typography>
            <Autocomplete
              options={inAppRecipientOptions}
              value={inAppRecipient}
              onChange={(_, v) => setInAppRecipient(v)}
              disabled={!canUse || meStatus === 'loading' || recipientsLoading}
              loading={recipientsLoading || meStatus === 'loading'}
              getOptionLabel={(o) => (o ? `${o.primaryLabel} (${o.secondaryLabel})` : '')}
              isOptionEqualToValue={(a, b) => Boolean(a && b && a.id === b.id)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('portalAdminNotificationTest.inApp.recipientLabel')}
                  helperText={t('portalAdminNotificationTest.inApp.recipientHelper')}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {(recipientsLoading || meStatus === 'loading') ? (
                          <CircularProgress color="inherit" size={16} sx={{ marginInlineEnd: 1 }} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <TextField
              label={t('portalAdminNotificationTest.fields.title')}
              value={inAppTitle}
              onChange={(e) => setInAppTitle(e.target.value)}
              disabled={!canUse}
              fullWidth
            />
            <TextField
              label={t('portalAdminNotificationTest.fields.body')}
              value={inAppBody}
              onChange={(e) => setInAppBody(e.target.value)}
              disabled={!canUse}
              fullWidth
              multiline
              minRows={3}
            />
            <Box>
              <Button
                type="button"
                variant="contained"
                disabled={
                  !canUse
                  || busy === 'in_app'
                  || !inAppRecipient?.id
                  || meStatus === 'loading'
                  || recipientsLoading
                }
                onClick={() => {
                  void runTest('in_app', {
                    target_user_id: inAppRecipient.id,
                    title: inAppTitle.trim() || undefined,
                    body: inAppBody.trim() || undefined,
                  });
                }}
              >
                {t('portalAdminNotificationTest.inApp.send')}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminNotificationTest;
