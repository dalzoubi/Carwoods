import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import StatusAlertSlot from './StatusAlertSlot';
import PortalRefreshButton from './PortalRefreshButton';
import PortalPersonWithAvatar from './PortalPersonWithAvatar';
import { ConfigFieldWithHelp } from './PortalConfigOptionHelp';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const BYTES_PER_MB = 1024 * 1024;

const EMPTY_FORM = {
  max_attachments: 3,
  max_image_mb: 10,
  max_video_mb: 50,
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
    max_image_mb: Math.max(1, Math.round(((config.max_image_bytes ?? (EMPTY_FORM.max_image_mb * BYTES_PER_MB)) / BYTES_PER_MB) * 100) / 100),
    max_video_mb: Math.max(1, Math.round(((config.max_video_bytes ?? (EMPTY_FORM.max_video_mb * BYTES_PER_MB)) / BYTES_PER_MB) * 100) / 100),
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
    max_image_bytes: Math.round(Number(form.max_image_mb) * BYTES_PER_MB),
    max_video_bytes: Math.round(Number(form.max_video_mb) * BYTES_PER_MB),
    max_video_duration_seconds: Number(form.max_video_duration_seconds),
    allowed_mime_types: listFromMultiline(form.allowed_mime_types),
    allowed_extensions: listFromMultiline(form.allowed_extensions),
    share_enabled: Boolean(form.share_enabled),
    share_expiry_seconds: Number(form.share_expiry_seconds),
    malware_scan_required: Boolean(form.malware_scan_required),
  };
}

function toFriendlyErrorMessage(t, fallbackKey) {
  return t(fallbackKey);
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
  const sortedLandlords = useMemo(
    () =>
      [...landlords].sort((a, b) => {
        const aLabel = String(a?.name ?? a?.email ?? a?.id ?? '').trim();
        const bLabel = String(b?.name ?? b?.email ?? b?.id ?? '').trim();
        return collator.compare(aLabel, bLabel);
      }),
    [landlords]
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
      const sortedRows = [...landlordRows].sort((a, b) => {
        const aLabel = String(a?.name ?? a?.email ?? a?.id ?? '').trim();
        const bLabel = String(b?.name ?? b?.email ?? b?.id ?? '').trim();
        return collator.compare(aLabel, bLabel);
      });
      setLandlords(sortedRows);
      const firstLandlordId = sortedRows[0]?.id || '';
      setSelectedLandlordId((prev) => prev || firstLandlordId);
      setStatus('ok');
    } catch (loadError) {
      handleApiForbidden(loadError);
      setStatus('error');
      setError(toFriendlyErrorMessage(t, 'portalAdminAttachmentConfig.errors.loadFailed'));
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
      setError(toFriendlyErrorMessage(t, 'portalAdminAttachmentConfig.errors.saveFailed'));
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
      setError(toFriendlyErrorMessage(t, 'portalAdminAttachmentConfig.errors.saveFailed'));
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
      setError(toFriendlyErrorMessage(t, 'portalAdminAttachmentConfig.errors.saveFailed'));
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalAdminAttachmentConfig.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalAdminAttachmentConfig.intro')}</Typography>
          </Box>
          <PortalRefreshButton
            label={t('portalAdminAttachmentConfig.actions.refresh')}
            onClick={() => void load()}
            disabled={!canUseModule}
            loading={status === 'loading'}
          />
        </Stack>
        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalAdminAttachmentConfig.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalAdminAttachmentConfig.errors.signInRequired') } : null}
        />
        <StatusAlertSlot
          message={isAuthenticated && !isAdmin
            ? { severity: 'error', text: t('portalAdminAttachmentConfig.errors.adminOnly') }
            : null}
        />
        <StatusAlertSlot
          message={status === 'error'
            ? { severity: 'error', text: error || t('portalAdminAttachmentConfig.errors.loadFailed') }
            : null}
        />
        <StatusAlertSlot
          message={saveStatus === 'ok'
            ? { severity: 'success', text: t('portalAdminAttachmentConfig.messages.saved') }
            : null}
        />
        <StatusAlertSlot
          message={saveStatus === 'error'
            ? { severity: 'error', text: error || t('portalAdminAttachmentConfig.errors.saveFailed') }
            : null}
        />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAttachmentConfig.global.heading')}
            </Typography>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.maxAttachments"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxAttachments"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxAttachments')} type="number" value={globalForm.max_attachments} onChange={onGlobalField('max_attachments')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.maxImageBytes"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxImageBytes"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxImageBytes')} type="number" value={globalForm.max_image_mb} onChange={onGlobalField('max_image_mb')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.maxVideoBytes"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxVideoBytes"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxVideoBytes')} type="number" value={globalForm.max_video_mb} onChange={onGlobalField('max_video_mb')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.maxVideoDurationSeconds"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxVideoDurationSeconds"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxVideoDurationSeconds')} type="number" value={globalForm.max_video_duration_seconds} onChange={onGlobalField('max_video_duration_seconds')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.allowedMimeTypes"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.allowedMimeTypes"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.allowedMimeTypes')} multiline minRows={2} value={globalForm.allowed_mime_types} onChange={onGlobalField('allowed_mime_types')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.allowedExtensions"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.allowedExtensions"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.allowedExtensions')} multiline minRows={2} value={globalForm.allowed_extensions} onChange={onGlobalField('allowed_extensions')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.shareExpirySeconds"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.shareExpirySeconds"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.shareExpirySeconds')} type="number" value={globalForm.share_expiry_seconds} onChange={onGlobalField('share_expiry_seconds')} />
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.shareEnabled"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.shareEnabled"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField
                fullWidth
                select
                label={t('portalAdminAttachmentConfig.fields.shareEnabled')}
                value={globalForm.share_enabled ? 'true' : 'false'}
                onChange={(event) => setGlobalForm((prev) => ({ ...prev, share_enabled: event.target.value === 'true' }))}
              >
                <MenuItem value="true">{t('portalAdminAttachmentConfig.common.enabled')}</MenuItem>
                <MenuItem value="false">{t('portalAdminAttachmentConfig.common.disabled')}</MenuItem>
              </TextField>
            </ConfigFieldWithHelp>
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.fields.malwareScanRequired"
              bodyKey="portalAdminAttachmentConfig.optionHelp.fields.malwareScanRequired"
              disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
            >
              <TextField
                fullWidth
                select
                label={t('portalAdminAttachmentConfig.fields.malwareScanRequired')}
                value={globalForm.malware_scan_required ? 'true' : 'false'}
                onChange={(event) => setGlobalForm((prev) => ({ ...prev, malware_scan_required: event.target.value === 'true' }))}
              >
                <MenuItem value="true">{t('portalAdminAttachmentConfig.common.required')}</MenuItem>
                <MenuItem value="false">{t('portalAdminAttachmentConfig.common.optional')}</MenuItem>
              </TextField>
            </ConfigFieldWithHelp>
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
            <ConfigFieldWithHelp
              labelKey="portalAdminAttachmentConfig.overrides.landlord"
              bodyKey="portalAdminAttachmentConfig.optionHelp.overrides.landlord"
              disabled={!canUseModule}
            >
              <TextField
                fullWidth
                select
                label={t('portalAdminAttachmentConfig.overrides.landlord')}
                value={selectedLandlordId}
                onChange={(event) => setSelectedLandlordId(event.target.value)}
              >
                {sortedLandlords.map((landlord) => {
                  const first = String(landlord.first_name ?? '').trim();
                  const last = String(landlord.last_name ?? '').trim();
                  const label = `${first} ${last}`.trim() || String(landlord.email ?? landlord.name ?? landlord.id ?? '').trim();
                  return (
                    <MenuItem key={landlord.id} value={landlord.id}>
                      <PortalPersonWithAvatar
                        photoUrl={String(landlord.profile_photo_url ?? '').trim()}
                        firstName={landlord.first_name ?? ''}
                        lastName={landlord.last_name ?? ''}
                        size={28}
                        alignItems="center"
                      >
                        <Typography variant="body2" component="span">
                          {label}
                        </Typography>
                      </PortalPersonWithAvatar>
                    </MenuItem>
                  );
                })}
              </TextField>
            </ConfigFieldWithHelp>
            {selectedLandlordId && (
              <>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.maxAttachments"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxAttachments"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxAttachments')} type="number" value={landlordForm.max_attachments} onChange={onLandlordField('max_attachments')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.maxImageBytes"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxImageBytes"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxImageBytes')} type="number" value={landlordForm.max_image_mb} onChange={onLandlordField('max_image_mb')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.maxVideoBytes"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxVideoBytes"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxVideoBytes')} type="number" value={landlordForm.max_video_mb} onChange={onLandlordField('max_video_mb')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.maxVideoDurationSeconds"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.maxVideoDurationSeconds"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.maxVideoDurationSeconds')} type="number" value={landlordForm.max_video_duration_seconds} onChange={onLandlordField('max_video_duration_seconds')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.allowedMimeTypes"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.allowedMimeTypes"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.allowedMimeTypes')} multiline minRows={2} value={landlordForm.allowed_mime_types} onChange={onLandlordField('allowed_mime_types')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.allowedExtensions"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.allowedExtensions"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.allowedExtensions')} multiline minRows={2} value={landlordForm.allowed_extensions} onChange={onLandlordField('allowed_extensions')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.shareExpirySeconds"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.shareExpirySeconds"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField fullWidth label={t('portalAdminAttachmentConfig.fields.shareExpirySeconds')} type="number" value={landlordForm.share_expiry_seconds} onChange={onLandlordField('share_expiry_seconds')} />
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.shareEnabled"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.shareEnabled"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField
                    fullWidth
                    select
                    label={t('portalAdminAttachmentConfig.fields.shareEnabled')}
                    value={landlordForm.share_enabled ? 'true' : 'false'}
                    onChange={(event) => setLandlordForm((prev) => ({ ...prev, share_enabled: event.target.value === 'true' }))}
                  >
                    <MenuItem value="true">{t('portalAdminAttachmentConfig.common.enabled')}</MenuItem>
                    <MenuItem value="false">{t('portalAdminAttachmentConfig.common.disabled')}</MenuItem>
                  </TextField>
                </ConfigFieldWithHelp>
                <ConfigFieldWithHelp
                  labelKey="portalAdminAttachmentConfig.fields.malwareScanRequired"
                  bodyKey="portalAdminAttachmentConfig.optionHelp.fields.malwareScanRequired"
                  disabled={!canUseModule || saveStatus === 'saving' || status === 'loading'}
                >
                  <TextField
                    fullWidth
                    select
                    label={t('portalAdminAttachmentConfig.fields.malwareScanRequired')}
                    value={landlordForm.malware_scan_required ? 'true' : 'false'}
                    onChange={(event) => setLandlordForm((prev) => ({ ...prev, malware_scan_required: event.target.value === 'true' }))}
                  >
                    <MenuItem value="true">{t('portalAdminAttachmentConfig.common.required')}</MenuItem>
                    <MenuItem value="false">{t('portalAdminAttachmentConfig.common.optional')}</MenuItem>
                  </TextField>
                </ConfigFieldWithHelp>
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

