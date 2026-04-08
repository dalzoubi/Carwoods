import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import {
  fetchElsaSettings,
  patchElsaCategoryPolicy,
  patchElsaPriorityPolicy,
  patchElsaPropertyPolicy,
  patchElsaSettings,
} from '../lib/portalApiClient';

const FEATURE_ELSA_AUTO = import.meta.env.VITE_FEATURE_ELSA_AUTO === 'true';

const EMPTY_FORM = {
  elsa_enabled: false,
  elsa_auto_send_enabled: false,
  elsa_auto_send_confidence_threshold: '',
  elsa_max_questions: '',
  elsa_max_steps: '',
  elsa_emergency_template_enabled: false,
  elsa_allowed_categories: '',
  elsa_allowed_priorities: '',
  elsa_blocked_keywords: '',
  elsa_emergency_keywords: '',
  elsa_admin_alert_recipients: '',
};

function splitList(value) {
  return String(value ?? '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value) {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
}

function errorMessage(error) {
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'request_failed';
}

function toNullableNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toForm(settings) {
  return {
    elsa_enabled: Boolean(settings?.elsa_enabled),
    elsa_auto_send_enabled: Boolean(settings?.elsa_auto_send_enabled),
    elsa_auto_send_confidence_threshold: settings?.elsa_auto_send_confidence_threshold ?? '',
    elsa_max_questions: settings?.elsa_max_questions ?? '',
    elsa_max_steps: settings?.elsa_max_steps ?? '',
    elsa_emergency_template_enabled: Boolean(settings?.elsa_emergency_template_enabled),
    elsa_allowed_categories: joinList(settings?.elsa_allowed_categories),
    elsa_allowed_priorities: joinList(settings?.elsa_allowed_priorities),
    elsa_blocked_keywords: joinList(settings?.elsa_blocked_keywords),
    elsa_emergency_keywords: joinList(settings?.elsa_emergency_keywords),
    elsa_admin_alert_recipients: joinList(settings?.elsa_admin_alert_recipients),
  };
}

const PortalAdminAiConfig = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    getAccessToken,
    handleApiForbidden,
  } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = FEATURE_ELSA_AUTO && isAuthenticated && isAdmin && Boolean(baseUrl);

  const [loadStatus, setLoadStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [globalStatus, setGlobalStatus] = useState('idle');
  const [globalMessage, setGlobalMessage] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [categoryPolicies, setCategoryPolicies] = useState([]);
  const [priorityPolicies, setPriorityPolicies] = useState([]);
  const [propertyPolicies, setPropertyPolicies] = useState([]);

  const [categorySaving, setCategorySaving] = useState('');
  const [prioritySaving, setPrioritySaving] = useState('');
  const [propertySaving, setPropertySaving] = useState('');

  const load = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setLoadStatus('idle');
      setLoadError('');
      setForm(EMPTY_FORM);
      setCategoryPolicies([]);
      setPriorityPolicies([]);
      setPropertyPolicies([]);
      return;
    }
    setLoadStatus('loading');
    setLoadError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchElsaSettings(baseUrl, token, { emailHint });
      const categories = Array.isArray(payload?.categories) ? payload.categories : [];
      const priorities = Array.isArray(payload?.priorities) ? payload.priorities : [];
      const properties = Array.isArray(payload?.properties) ? payload.properties : [];
      setForm(toForm(payload?.settings ?? null));
      setCategoryPolicies(
        categories.map((row) => ({
          category_code: String(row?.category_code ?? ''),
          auto_send_enabled: Boolean(row?.auto_send_enabled),
        }))
      );
      setPriorityPolicies(
        priorities.map((row) => ({
          priority_code: String(row?.priority_code ?? ''),
          auto_send_enabled: Boolean(row?.auto_send_enabled),
          require_admin_review: Boolean(row?.require_admin_review),
        }))
      );
      setPropertyPolicies(
        properties.map((row) => ({
          property_id: String(row?.property_id ?? ''),
          auto_send_enabled_override:
            row?.auto_send_enabled_override === null
              ? 'inherit'
              : row?.auto_send_enabled_override === true
                ? 'enabled'
                : 'disabled',
          require_review_all: Boolean(row?.require_review_all),
        }))
      );
      setLoadStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setLoadStatus('error');
      setLoadError(errorMessage(error));
    }
  }, [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  const onField = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (globalStatus !== 'saving') {
      setGlobalStatus('idle');
      setGlobalMessage('');
    }
  };

  const hasGlobalValidationError = useMemo(() => {
    const confidence = toNullableNumber(form.elsa_auto_send_confidence_threshold);
    if (confidence !== null && (confidence < 0 || confidence > 1)) return true;
    const maxQuestions = toNullableNumber(form.elsa_max_questions);
    if (maxQuestions !== null && maxQuestions < 0) return true;
    const maxSteps = toNullableNumber(form.elsa_max_steps);
    if (maxSteps !== null && maxSteps < 0) return true;
    return false;
  }, [form]);

  const onSaveGlobal = async () => {
    if (!canUseModule || !baseUrl || hasGlobalValidationError) return;
    setGlobalStatus('saving');
    setGlobalMessage('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaSettings(baseUrl, token, {
        emailHint,
        elsa_enabled: Boolean(form.elsa_enabled),
        elsa_auto_send_enabled: Boolean(form.elsa_auto_send_enabled),
        elsa_auto_send_confidence_threshold: toNullableNumber(form.elsa_auto_send_confidence_threshold),
        elsa_allowed_categories: splitList(form.elsa_allowed_categories),
        elsa_allowed_priorities: splitList(form.elsa_allowed_priorities),
        elsa_blocked_keywords: splitList(form.elsa_blocked_keywords),
        elsa_emergency_keywords: splitList(form.elsa_emergency_keywords),
        elsa_max_questions: toNullableNumber(form.elsa_max_questions),
        elsa_max_steps: toNullableNumber(form.elsa_max_steps),
        elsa_admin_alert_recipients: splitList(form.elsa_admin_alert_recipients),
        elsa_emergency_template_enabled: Boolean(form.elsa_emergency_template_enabled),
      });
      setGlobalStatus('ok');
      setGlobalMessage(t('portalAdminAiConfig.messages.globalSaved'));
      await load();
    } catch (error) {
      handleApiForbidden(error);
      setGlobalStatus('error');
      setGlobalMessage(errorMessage(error));
    }
  };

  const saveCategory = async (row) => {
    if (!canUseModule || !baseUrl || !row?.category_code) return;
    setCategorySaving(row.category_code);
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaCategoryPolicy(baseUrl, token, row.category_code, {
        emailHint,
        auto_send_enabled: Boolean(row.auto_send_enabled),
      });
      await load();
    } catch (error) {
      handleApiForbidden(error);
      setLoadError(errorMessage(error));
    } finally {
      setCategorySaving('');
    }
  };

  const savePriority = async (row) => {
    if (!canUseModule || !baseUrl || !row?.priority_code) return;
    setPrioritySaving(row.priority_code);
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaPriorityPolicy(baseUrl, token, row.priority_code, {
        emailHint,
        auto_send_enabled: Boolean(row.auto_send_enabled),
        require_admin_review: Boolean(row.require_admin_review),
      });
      await load();
    } catch (error) {
      handleApiForbidden(error);
      setLoadError(errorMessage(error));
    } finally {
      setPrioritySaving('');
    }
  };

  const saveProperty = async (row) => {
    if (!canUseModule || !baseUrl || !row?.property_id) return;
    setPropertySaving(row.property_id);
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const override = row.auto_send_enabled_override === 'inherit'
        ? null
        : row.auto_send_enabled_override === 'enabled';
      await patchElsaPropertyPolicy(baseUrl, token, row.property_id, {
        emailHint,
        auto_send_enabled_override: override,
        require_review_all: Boolean(row.require_review_all),
      });
      await load();
    } catch (error) {
      handleApiForbidden(error);
      setLoadError(errorMessage(error));
    } finally {
      setPropertySaving('');
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalAdminAiConfig.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalAdminAiConfig.intro')}</Typography>
          </Box>
          <Button
            type="button"
            size="small"
            variant="outlined"
            onClick={() => void load()}
            disabled={!canUseModule || loadStatus === 'loading'}
            startIcon={loadStatus === 'loading' ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
          >
            {t('portalAdminAiConfig.actions.refresh')}
          </Button>
        </Stack>

        {!FEATURE_ELSA_AUTO && (
          <Alert severity="info">{t('portalAdminAiConfig.errors.featureDisabled')}</Alert>
        )}
        {!baseUrl && <Alert severity="warning">{t('portalAdminAiConfig.errors.apiUnavailable')}</Alert>}
        {!isAuthenticated && <Alert severity="warning">{t('portalAdminAiConfig.errors.signInRequired')}</Alert>}
        {isAuthenticated && !isAdmin && <Alert severity="error">{t('portalAdminAiConfig.errors.adminOnly')}</Alert>}
        {loadStatus === 'error' && <Alert severity="error">{loadError || t('portalAdminAiConfig.errors.loadFailed')}</Alert>}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAiConfig.global.heading')}
            </Typography>
            <FormControlLabel
              control={<Switch checked={Boolean(form.elsa_enabled)} onChange={onField('elsa_enabled')} />}
              label={t('portalAdminAiConfig.global.elsaEnabled')}
              disabled={!canUseModule || globalStatus === 'saving'}
            />
            <FormControlLabel
              control={<Switch checked={Boolean(form.elsa_auto_send_enabled)} onChange={onField('elsa_auto_send_enabled')} />}
              label={t('portalAdminAiConfig.global.autoSendEnabled')}
              disabled={!canUseModule || globalStatus === 'saving'}
            />
            <FormControlLabel
              control={<Switch checked={Boolean(form.elsa_emergency_template_enabled)} onChange={onField('elsa_emergency_template_enabled')} />}
              label={t('portalAdminAiConfig.global.emergencyTemplateEnabled')}
              disabled={!canUseModule || globalStatus === 'saving'}
            />
            <TextField
              label={t('portalAdminAiConfig.global.confidenceThreshold')}
              value={form.elsa_auto_send_confidence_threshold}
              onChange={onField('elsa_auto_send_confidence_threshold')}
              disabled={!canUseModule || globalStatus === 'saving'}
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.01 }}
              error={toNullableNumber(form.elsa_auto_send_confidence_threshold) !== null
                && (toNullableNumber(form.elsa_auto_send_confidence_threshold) < 0
                  || toNullableNumber(form.elsa_auto_send_confidence_threshold) > 1)}
              helperText={t('portalAdminAiConfig.global.confidenceHelp')}
            />
            <TextField
              label={t('portalAdminAiConfig.global.maxQuestions')}
              value={form.elsa_max_questions}
              onChange={onField('elsa_max_questions')}
              disabled={!canUseModule || globalStatus === 'saving'}
              type="number"
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              label={t('portalAdminAiConfig.global.maxSteps')}
              value={form.elsa_max_steps}
              onChange={onField('elsa_max_steps')}
              disabled={!canUseModule || globalStatus === 'saving'}
              type="number"
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              label={t('portalAdminAiConfig.global.allowedCategories')}
              value={form.elsa_allowed_categories}
              onChange={onField('elsa_allowed_categories')}
              disabled={!canUseModule || globalStatus === 'saving'}
              multiline
              minRows={2}
            />
            <TextField
              label={t('portalAdminAiConfig.global.allowedPriorities')}
              value={form.elsa_allowed_priorities}
              onChange={onField('elsa_allowed_priorities')}
              disabled={!canUseModule || globalStatus === 'saving'}
              multiline
              minRows={2}
            />
            <TextField
              label={t('portalAdminAiConfig.global.blockedKeywords')}
              value={form.elsa_blocked_keywords}
              onChange={onField('elsa_blocked_keywords')}
              disabled={!canUseModule || globalStatus === 'saving'}
              multiline
              minRows={2}
            />
            <TextField
              label={t('portalAdminAiConfig.global.emergencyKeywords')}
              value={form.elsa_emergency_keywords}
              onChange={onField('elsa_emergency_keywords')}
              disabled={!canUseModule || globalStatus === 'saving'}
              multiline
              minRows={2}
            />
            <TextField
              label={t('portalAdminAiConfig.global.adminAlertRecipients')}
              value={form.elsa_admin_alert_recipients}
              onChange={onField('elsa_admin_alert_recipients')}
              disabled={!canUseModule || globalStatus === 'saving'}
              multiline
              minRows={2}
            />
            <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="contained"
                onClick={() => void onSaveGlobal()}
                disabled={!canUseModule || globalStatus === 'saving' || hasGlobalValidationError}
              >
                {globalStatus === 'saving'
                  ? t('portalAdminAiConfig.actions.saving')
                  : t('portalAdminAiConfig.actions.saveGlobal')}
              </Button>
            </Stack>
            {globalStatus === 'ok' && <Alert severity="success">{globalMessage}</Alert>}
            {globalStatus === 'error' && <Alert severity="error">{globalMessage || t('portalAdminAiConfig.errors.saveFailed')}</Alert>}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAiConfig.categories.heading')}
            </Typography>
            {categoryPolicies.length === 0 && <Typography color="text.secondary">{t('portalAdminAiConfig.categories.empty')}</Typography>}
            {categoryPolicies.map((row, idx) => (
              <Stack key={row.category_code || `category-${idx}`} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                <Box sx={{ minWidth: 180 }}>
                  <Typography sx={{ fontWeight: 600 }}>{row.category_code || '-'}</Typography>
                </Box>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={Boolean(row.auto_send_enabled)}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setCategoryPolicies((prev) => prev.map((item) => (
                          item.category_code === row.category_code ? { ...item, auto_send_enabled: next } : item
                        )));
                      }}
                    />
                  )}
                  label={t('portalAdminAiConfig.categories.autoSend')}
                  disabled={!canUseModule || categorySaving === row.category_code}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => void saveCategory(row)}
                  disabled={!canUseModule || categorySaving === row.category_code}
                >
                  {categorySaving === row.category_code
                    ? t('portalAdminAiConfig.actions.saving')
                    : t('portalAdminAiConfig.actions.saveRow')}
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAiConfig.priorities.heading')}
            </Typography>
            {priorityPolicies.length === 0 && <Typography color="text.secondary">{t('portalAdminAiConfig.priorities.empty')}</Typography>}
            {priorityPolicies.map((row, idx) => (
              <Stack key={row.priority_code || `priority-${idx}`} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                <Box sx={{ minWidth: 180 }}>
                  <Typography sx={{ fontWeight: 600 }}>{row.priority_code || '-'}</Typography>
                </Box>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={Boolean(row.auto_send_enabled)}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setPriorityPolicies((prev) => prev.map((item) => (
                          item.priority_code === row.priority_code ? { ...item, auto_send_enabled: next } : item
                        )));
                      }}
                    />
                  )}
                  label={t('portalAdminAiConfig.priorities.autoSend')}
                  disabled={!canUseModule || prioritySaving === row.priority_code}
                />
                <FormControlLabel
                  control={(
                    <Switch
                      checked={Boolean(row.require_admin_review)}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setPriorityPolicies((prev) => prev.map((item) => (
                          item.priority_code === row.priority_code ? { ...item, require_admin_review: next } : item
                        )));
                      }}
                    />
                  )}
                  label={t('portalAdminAiConfig.priorities.requireReview')}
                  disabled={!canUseModule || prioritySaving === row.priority_code}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => void savePriority(row)}
                  disabled={!canUseModule || prioritySaving === row.priority_code}
                >
                  {prioritySaving === row.priority_code
                    ? t('portalAdminAiConfig.actions.saving')
                    : t('portalAdminAiConfig.actions.saveRow')}
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAiConfig.properties.heading')}
            </Typography>
            {propertyPolicies.length === 0 && <Typography color="text.secondary">{t('portalAdminAiConfig.properties.empty')}</Typography>}
            {propertyPolicies.map((row, idx) => (
              <Stack key={row.property_id || `property-${idx}`} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                <Box sx={{ minWidth: 220 }}>
                  <Typography sx={{ fontWeight: 600 }}>{row.property_id || '-'}</Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id={`property-override-${idx}`}>{t('portalAdminAiConfig.properties.autoSendOverride')}</InputLabel>
                  <Select
                    labelId={`property-override-${idx}`}
                    label={t('portalAdminAiConfig.properties.autoSendOverride')}
                    value={row.auto_send_enabled_override}
                    onChange={(event) => {
                      const next = event.target.value;
                      setPropertyPolicies((prev) => prev.map((item) => (
                        item.property_id === row.property_id ? { ...item, auto_send_enabled_override: next } : item
                      )));
                    }}
                    disabled={!canUseModule || propertySaving === row.property_id}
                  >
                    <MenuItem value="inherit">{t('portalAdminAiConfig.properties.inherit')}</MenuItem>
                    <MenuItem value="enabled">{t('portalAdminAiConfig.properties.enabled')}</MenuItem>
                    <MenuItem value="disabled">{t('portalAdminAiConfig.properties.disabled')}</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={Boolean(row.require_review_all)}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setPropertyPolicies((prev) => prev.map((item) => (
                          item.property_id === row.property_id ? { ...item, require_review_all: next } : item
                        )));
                      }}
                    />
                  )}
                  label={t('portalAdminAiConfig.properties.requireReviewAll')}
                  disabled={!canUseModule || propertySaving === row.property_id}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => void saveProperty(row)}
                  disabled={!canUseModule || propertySaving === row.property_id}
                >
                  {propertySaving === row.property_id
                    ? t('portalAdminAiConfig.actions.saving')
                    : t('portalAdminAiConfig.actions.saveRow')}
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
};

export default PortalAdminAiConfig;
