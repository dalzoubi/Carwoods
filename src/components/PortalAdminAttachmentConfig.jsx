import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import {
  deleteAttachmentUploadLandlordConfig,
  fetchAttachmentUploadConfig,
  fetchLandlords,
  patchAttachmentUploadGlobalConfig,
  patchAttachmentUploadLandlordConfig,
} from '../lib/portalApiClient';

const EMPTY_FORM = {
  max_attachments: 3,
  max_image_bytes: 10 * 1024 * 1024,
  max_video_bytes: 50 * 1024 * 1024,
  max_video_duration_seconds: 10,
  allowed_mime_types: 'image/*\nvideo/*',
  allowed_extensions: 'jpg\njpeg\npng\ngif\nwebp\nmp4\nmov\nwebm',
  share_enabled: true,
  share_expiry_seconds: 86400,
  malware_scan_required: false,
};

function listFromMultiline(value) {
  return String(value ?? '')
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function formFromConfig(config) {
  if (!config) return { ...EMPTY_FORM };
  return {
    max_attachments: config.max_attachments ?? EMPTY_FORM.max_attachments,
    max_image_bytes: config.max_image_bytes ?? EMPTY_FORM.max_image_bytes,
    max_video_bytes: config.max_video_bytes ?? EMPTY_FORM.max_video_bytes,
    max_video_duration_seconds:
      config.max_video_duration_seconds ?? EMPTY_FORM.max_video_duration_seconds,
    allowed_mime_types: Array.isArray(config.allowed_mime_types)
      ? config.allowed_mime_types.join('\n')
      : EMPTY_FORM.allowed_mime_types,
    allowed_extensions: Array.isArray(config.allowed_extensions)
      ? config.allowed_extensions.join('\n')
      : EMPTY_FORM.allowed_extensions,
    share_enabled: Boolean(config.share_enabled),
    share_expiry_seconds: config.share_expiry_seconds ?? EMPTY_FORM.share_expiry_seconds,
    malware_scan_required: Boolean(config.malware_scan_required),
  };
}

function payloadFromForm(form) {
  return {
    max_attachments: Number(form.max_attachments),
    max_image_bytes: Number(form.max_image_bytes),
    max_video_bytes: Number(form.max_video_bytes),
    max_video_duration_seconds: Number(form.max_video_duration_seconds),
    allowed_mime_types: listFromMultiline(form.allowed_mime_types),
    allowed_extensions: listFromMultiline(form.allowed_extensions),
    share_enabled: Boolean(form.share_enabled),
    share_expiry_seconds: Number(form.share_expiry_seconds),
    malware_scan_required: Boolean(form.malware_scan_required),
  };
}

const PortalAdminAttachmentConfig = () => {
  const { t } = useTranslation();
  const { baseUrl, isAuthenticated, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [globalForm, setGlobalForm] = useState({ ...EMPTY_FORM });
  const [landlordForm, setLandlordForm] = useState({ ...EMPTY_FORM });
  const [selectedLandlordId, setSelectedLandlordId] = useState('');
  const [landlords, setLandlords] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, mode: 'global' });

  const selectedOverride = useMemo(
    () => overrides.find((row) => row.landlord_user_id === selectedLandlordId) || null,
    [overrides, selectedLandlordId]
  );

  const load = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setStatus('idle');
      setError('');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const [configPayload, landlordsPayload] = await Promise.all([
        fetchAttachmentUploadConfig(baseUrl, token, { emailHint }),
        fetchLandlords(baseUrl, token, { includeInactive: false }),
      ]);
      setGlobalForm(formFromConfig(configPayload?.global));
      const nextOverrides = Array.isArray(configPayload?.overrides) ? configPayload.overrides : [];
      setOverrides(nextOverrides);
      const landlordRows = Array.isArray(landlordsPayload?.landlords) ? landlordsPayload.landlords : [];
      setLandlords(landlordRows);
      const firstLandlordId = landlordRows[0]?.id || '';
      setSelectedLandlordId((prev) => prev || firstLandlordId);
      setStatus('ok');
    } catch (loadError) {
      handleApiForbidden(loadError);
      setStatus('error');
      setError(loadError?.message || t('portalAdminAttachmentConfig.errors.loadFailed'));
    }
  }, [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setLandlordForm(formFromConfig(selectedOverride));
  }, [selectedOverride]);

  const onGlobalField = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setGlobalForm((prev) => ({ ...prev, [field]: value }));
  };

  const onLandlordField = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setLandlordForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveGlobal = async () => {
    if (!canUseModule || !baseUrl) return;
    setSaveStatus('saving');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchAttachmentUploadGlobalConfig(baseUrl, token, {
        emailHint,
        ...payloadFromForm(globalForm),
      });
      setSaveStatus('ok');
      await load();
    } catch (saveError) {
      handleApiForbidden(saveError);
      setSaveStatus('error');
      setError(saveError?.message || t('portalAdminAttachmentConfig.errors.saveFailed'));
    }
  };

  const saveLandlordOverride = async () => {
    if (!canUseModule || !baseUrl || !selectedLandlordId) return;
    setSaveStatus('saving');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchAttachmentUploadLandlordConfig(baseUrl, token, selectedLandlordId, {
        emailHint,
        ...payloadFromForm(landlordForm),
      });
      setSaveStatus('ok');
      await load();
    } catch (saveError) {
      handleApiForbidden(saveError);
      setSaveStatus('error');
      setError(saveError?.message || t('portalAdminAttachmentConfig.errors.saveFailed'));
    }
  };

  const deleteOverride = async () => {
    if (!canUseModule || !baseUrl || !selectedLandlordId) return;
    setSaveStatus('saving');
    setError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await deleteAttachmentUploadLandlordConfig(baseUrl, token, selectedLandlordId, { emailHint });
      setSaveStatus('ok');
      await load();
    } catch (deleteError) {
      handleApiForbidden(deleteError);
      setSaveStatus('error');
      setError(deleteError?.message || t('portalAdminAttachmentConfig.errors.saveFailed'));
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
            {t('portalAdminAttachmentConfig.heading')}
          </Typography>
          <Typography color="text.secondary">{t('portalAdminAttachmentConfig.intro')}</Typography>
        </Box>
        {!baseUrl && <Alert severity="warning">{t('portalAdminAttachmentConfig.errors.apiUnavailable')}</Alert>}
        {!isAuthenticated && <Alert severity="warning">{t('portalAdminAttachmentConfig.errors.signInRequired')}</Alert>}
        {isAuthenticated && !isAdmin && <Alert severity="error">{t('portalAdminAttachmentConfig.errors.adminOnly')}</Alert>}
        {status === 'error' && <Alert severity="error">{error || t('portalAdminAttachmentConfig.errors.loadFailed')}</Alert>}
        {saveStatus === 'ok' && <Alert severity="success">{t('portalAdminAttachmentConfig.messages.saved')}</Alert>}
        {saveStatus === 'error' && <Alert severity="error">{error || t('portalAdminAttachmentConfig.errors.saveFailed')}</Alert>}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAttachmentConfig.global.heading')}
            </Typography>
            <TextField label={t('portalAdminAttachmentConfig.fields.maxAttachments')} type="number" value={globalForm.max_attachments} onChange={onGlobalField('max_attachments')} />
            <TextField label={t('portalAdminAttachmentConfig.fields.maxImageBytes')} type="number" value={globalForm.max_image_bytes} onChange={onGlobalField('max_image_bytes')} />
            <TextField label={t('portalAdminAttachmentConfig.fields.maxVideoBytes')} type="number" value={globalForm.max_video_bytes} onChange={onGlobalField('max_video_bytes')} />
            <TextField label={t('portalAdminAttachmentConfig.fields.maxVideoDurationSeconds')} type="number" value={globalForm.max_video_duration_seconds} onChange={onGlobalField('max_video_duration_seconds')} />
            <TextField label={t('portalAdminAttachmentConfig.fields.allowedMimeTypes')} multiline minRows={2} value={globalForm.allowed_mime_types} onChange={onGlobalField('allowed_mime_types')} />
            <TextField label={t('portalAdminAttachmentConfig.fields.allowedExtensions')} multiline minRows={2} value={globalForm.allowed_extensions} onChange={onGlobalField('allowed_extensions')} />
            <TextField label={t('portalAdminAttachmentConfig.fields.shareExpirySeconds')} type="number" value={globalForm.share_expiry_seconds} onChange={onGlobalField('share_expiry_seconds')} />
            <TextField
              select
              label={t('portalAdminAttachmentConfig.fields.shareEnabled')}
              value={globalForm.share_enabled ? 'true' : 'false'}
              onChange={(event) => setGlobalForm((prev) => ({ ...prev, share_enabled: event.target.value === 'true' }))}
            >
              <MenuItem value="true">{t('portalAdminAttachmentConfig.common.enabled')}</MenuItem>
              <MenuItem value="false">{t('portalAdminAttachmentConfig.common.disabled')}</MenuItem>
            </TextField>
            <TextField
              select
              label={t('portalAdminAttachmentConfig.fields.malwareScanRequired')}
              value={globalForm.malware_scan_required ? 'true' : 'false'}
              onChange={(event) => setGlobalForm((prev) => ({ ...prev, malware_scan_required: event.target.value === 'true' }))}
            >
              <MenuItem value="true">{t('portalAdminAttachmentConfig.common.required')}</MenuItem>
              <MenuItem value="false">{t('portalAdminAttachmentConfig.common.optional')}</MenuItem>
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button
                type="button"
                variant="contained"
                onClick={() => setConfirmState({ open: true, mode: 'global' })}
                disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
              >
                {saveStatus === 'saving' ? <CircularProgress size={16} color="inherit" /> : t('portalAdminAttachmentConfig.actions.saveGlobal')}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAttachmentConfig.overrides.heading')}
            </Typography>
            <TextField
              select
              label={t('portalAdminAttachmentConfig.overrides.landlord')}
              value={selectedLandlordId}
              onChange={(event) => setSelectedLandlordId(event.target.value)}
            >
              {landlords.map((landlord) => (
                <MenuItem key={landlord.id} value={landlord.id}>
                  {landlord.name || landlord.email || landlord.id}
                </MenuItem>
              ))}
            </TextField>
            {selectedLandlordId && (
              <>
                <TextField label={t('portalAdminAttachmentConfig.fields.maxAttachments')} type="number" value={landlordForm.max_attachments} onChange={onLandlordField('max_attachments')} />
                <TextField label={t('portalAdminAttachmentConfig.fields.maxImageBytes')} type="number" value={landlordForm.max_image_bytes} onChange={onLandlordField('max_image_bytes')} />
                <TextField label={t('portalAdminAttachmentConfig.fields.maxVideoBytes')} type="number" value={landlordForm.max_video_bytes} onChange={onLandlordField('max_video_bytes')} />
                <TextField label={t('portalAdminAttachmentConfig.fields.maxVideoDurationSeconds')} type="number" value={landlordForm.max_video_duration_seconds} onChange={onLandlordField('max_video_duration_seconds')} />
                <TextField label={t('portalAdminAttachmentConfig.fields.allowedMimeTypes')} multiline minRows={2} value={landlordForm.allowed_mime_types} onChange={onLandlordField('allowed_mime_types')} />
                <TextField label={t('portalAdminAttachmentConfig.fields.allowedExtensions')} multiline minRows={2} value={landlordForm.allowed_extensions} onChange={onLandlordField('allowed_extensions')} />
                <TextField label={t('portalAdminAttachmentConfig.fields.shareExpirySeconds')} type="number" value={landlordForm.share_expiry_seconds} onChange={onLandlordField('share_expiry_seconds')} />
                <TextField
                  select
                  label={t('portalAdminAttachmentConfig.fields.shareEnabled')}
                  value={landlordForm.share_enabled ? 'true' : 'false'}
                  onChange={(event) => setLandlordForm((prev) => ({ ...prev, share_enabled: event.target.value === 'true' }))}
                >
                  <MenuItem value="true">{t('portalAdminAttachmentConfig.common.enabled')}</MenuItem>
                  <MenuItem value="false">{t('portalAdminAttachmentConfig.common.disabled')}</MenuItem>
                </TextField>
                <TextField
                  select
                  label={t('portalAdminAttachmentConfig.fields.malwareScanRequired')}
                  value={landlordForm.malware_scan_required ? 'true' : 'false'}
                  onChange={(event) => setLandlordForm((prev) => ({ ...prev, malware_scan_required: event.target.value === 'true' }))}
                >
                  <MenuItem value="true">{t('portalAdminAttachmentConfig.common.required')}</MenuItem>
                  <MenuItem value="false">{t('portalAdminAttachmentConfig.common.optional')}</MenuItem>
                </TextField>
                <Stack direction="row" spacing={1}>
                  <Button
                    type="button"
                    variant="contained"
                    onClick={() => setConfirmState({ open: true, mode: 'override' })}
                    disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                  >
                    {t('portalAdminAttachmentConfig.actions.saveOverride')}
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    color="error"
                    onClick={() => setConfirmState({ open: true, mode: 'deleteOverride' })}
                    disabled={!selectedOverride || !canUseModule || saveStatus === 'saving'}
                  >
                    {t('portalAdminAttachmentConfig.actions.clearOverride')}
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>

      <Dialog open={confirmState.open} onClose={() => setConfirmState({ open: false, mode: 'global' })}>
        <DialogTitle>{t('portalAdminAttachmentConfig.confirm.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('portalAdminAttachmentConfig.confirm.body')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setConfirmState({ open: false, mode: 'global' })}>
            {t('portalAdminAttachmentConfig.confirm.cancel')}
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={async () => {
              const mode = confirmState.mode;
              setConfirmState({ open: false, mode: 'global' });
              if (mode === 'global') await saveGlobal();
              if (mode === 'override') await saveLandlordOverride();
              if (mode === 'deleteOverride') await deleteOverride();
            }}
          >
            {t('portalAdminAttachmentConfig.confirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default PortalAdminAttachmentConfig;

