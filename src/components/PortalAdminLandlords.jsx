import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { validatePersonBasics, validatePersonField } from '../portalPersonValidation';
import { resolveRole, normalizeRole } from '../portalUtils';
import { fetchLandlords, fetchAdminSubscriptionTiers, createLandlord, patchResource } from '../lib/portalApiClient';
import { buildVCard3, downloadVCard, slugifyVCardFilenameBase, VCARD_ORG_NAME } from '../lib/exportContactCard';
import PortalConfirmDialog from './PortalConfirmDialog';
import StatusAlertSlot from './StatusAlertSlot';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import MailtoEmailLink from './MailtoEmailLink';
import PortalRefreshButton from './PortalRefreshButton';
import PortalUserAvatar from './PortalUserAvatar';
import EmptyState from './EmptyState';
import useHighlightRow from '../lib/useHighlightRow';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function toFriendlyErrorMessage(t, fallbackKey) {
  return t(fallbackKey);
}

function displayName(landlord) {
  const first = String(landlord.first_name ?? '').trim();
  const last = String(landlord.last_name ?? '').trim();
  return `${first} ${last}`.trim() || '—';
}

function isActiveStatus(status) {
  return String(status ?? '').toUpperCase() === 'ACTIVE';
}

function exportLandlordContactVCard(landlord, t) {
  const first = String(landlord.first_name ?? '').trim();
  const last = String(landlord.last_name ?? '').trim();
  const email = String(landlord.email ?? '').trim();
  const vcard = buildVCard3({
    firstName: first,
    lastName: last,
    email: landlord.email,
    phone: landlord.phone,
    adr: null,
    org: VCARD_ORG_NAME,
    title: t('portalAdminLandlords.vCard.roleTitle'),
  });
  return downloadVCard(slugifyVCardFilenameBase(first, last, email), vcard);
}

function tierChipColor(tierName) {
  const n = String(tierName ?? '').toUpperCase();
  if (n === 'PRO') return 'primary';
  if (n === 'STARTER') return 'info';
  return 'default';
}

/** Normalize tier fields (mssql driver / cached payloads may vary casing or omit joined labels). */
function pickLandlordTierFields(landlord) {
  if (!landlord || typeof landlord !== 'object') {
    return { tier_id: null, tier_name: null, tier_display_name: null };
  }
  const rawId = landlord.tier_id ?? landlord.Tier_Id ?? landlord.tierId;
  const tier_id =
    rawId != null && String(rawId).trim() !== '' ? String(rawId).trim() : null;
  const pickStr = (...keys) => {
    for (const k of keys) {
      const v = landlord[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };
  return {
    tier_id,
    tier_name: pickStr('tier_name', 'Tier_Name', 'tierName'),
    tier_display_name: pickStr('tier_display_name', 'Tier_Display_Name', 'tierDisplayName'),
  };
}

const PortalAdminLandlords = () => {
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
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    tierId: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingLandlordId, setEditingLandlordId] = useState(null);
  const [editForm, setEditForm] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [submitState, setSubmitState] = useState({ status: 'idle', detail: '' });
  const [landlordsState, setLandlordsState] = useState({ status: 'idle', detail: '', landlords: [] });
  const [tiersState, setTiersState] = useState({ status: 'idle', detail: '', tiers: [] });
  const [tierDialog, setTierDialog] = useState({
    open: false,
    landlord: null,
    selectedTierId: '',
  });
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const hlLandlord = searchParams.get('hlLandlord');
  const hlExpandAttemptedRef = useRef(false);
  const [highlightTargetId, setHighlightTargetId] = useState(null);
  const [highlightAnnouncement, setHighlightAnnouncement] = useState('');

  const sortedLandlords = useMemo(
    () =>
      [...landlordsState.landlords].sort((a, b) => {
        const byName = collator.compare(displayName(a), displayName(b));
        if (byName !== 0) return byName;
        return collator.compare(String(a?.email ?? ''), String(b?.email ?? ''));
      }),
    [landlordsState.landlords]
  );

  // Confirmation dialog for toggle active/inactive
  const [confirmDialog, setConfirmDialog] = useState({ open: false, landlordId: null, activate: false, name: '' });

  const loadLandlords = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setLandlordsState({ status: 'idle', detail: '', landlords: [] });
      return;
    }
    setLandlordsState((prev) => ({ ...prev, status: 'loading', detail: '' }));
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchLandlords(baseUrl, accessToken, { includeInactive: showInactive });
      setLandlordsState({
        status: 'ok',
        detail: '',
        landlords: Array.isArray(payload?.landlords) ? payload.landlords : [],
      });
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.loadFailed');
      setLandlordsState({ status: 'error', detail, landlords: [] });
    }
  }, [baseUrl, canUseModule, getAccessToken, handleApiForbidden, showInactive]);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  useEffect(() => {
    const id = hlLandlord?.trim();
    if (!id) {
      hlExpandAttemptedRef.current = false;
      return undefined;
    }
    if (landlordsState.status !== 'ok') return undefined;
    const match = sortedLandlords.find((l) => String(l.id).toLowerCase() === id.toLowerCase());
    if (!match) {
      if (!showInactive && !hlExpandAttemptedRef.current) {
        hlExpandAttemptedRef.current = true;
        setShowInactive(true);
      }
      return undefined;
    }
    hlExpandAttemptedRef.current = false;

    setHighlightTargetId(String(match.id));
    setHighlightAnnouncement(
      t('portalAdminLandlords.list.highlightAnnouncement', { name: displayName(match) }),
    );

    const next = new URLSearchParams(searchParams);
    next.delete('hlLandlord');
    setSearchParams(next, { replace: true });

    return undefined;
  }, [hlLandlord, landlordsState.status, sortedLandlords, showInactive, searchParams, setSearchParams, t]);

  const {
    flashId: flashLandlordId,
    ariaAnnouncement: landlordHighlightAnnouncement,
    getRowProps: getLandlordHighlightProps,
  } = useHighlightRow({
    targetId: highlightTargetId,
    elementIdFor: (id) => `landlord-row-${id}`,
    announcement: highlightAnnouncement,
    durationMs: 9000,
    ready: landlordsState.status === 'ok',
  });

  const loadTiers = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setTiersState({ status: 'idle', detail: '', tiers: [] });
      return;
    }
    setTiersState((prev) => ({ ...prev, status: 'loading', detail: '' }));
    try {
      const accessToken = await getAccessToken();
      const payload = await fetchAdminSubscriptionTiers(baseUrl, accessToken);
      setTiersState({
        status: 'ok',
        detail: '',
        tiers: Array.isArray(payload?.tiers) ? payload.tiers : [],
      });
    } catch (error) {
      handleApiForbidden(error);
      setTiersState({
        status: 'error',
        detail: toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.tierListFailed'),
        tiers: [],
      });
    }
  }, [baseUrl, canUseModule, getAccessToken, handleApiForbidden, t]);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  const formErrors = useMemo(
    () =>
      validatePersonBasics(form, t, {
        keys: {
          firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
          lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
          emailRequired: 'portalAdminLandlords.errors.emailRequired',
          emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
        },
      }),
    [form, t]
  );
  const isFormValid = Object.keys(formErrors).length === 0;

  const createPlanChoiceOk = useMemo(() => {
    if (tiersState.status === 'loading') return false;
    if (tiersState.status === 'error') return true;
    if (tiersState.status !== 'ok') return false;
    if (tiersState.tiers.length === 0) return true;
    return Boolean(String(form.tierId ?? '').trim());
  }, [form.tierId, tiersState.status, tiersState.tiers.length]);

  const canSubmitCreate = isFormValid && createPlanChoiceOk;
  const editFormErrors = useMemo(
    () =>
      validatePersonBasics(editForm, t, {
        keys: {
          firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
          lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
          emailRequired: 'portalAdminLandlords.errors.emailRequired',
          emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
        },
      }),
    [editForm, t]
  );
  const isEditFormValid = Object.keys(editFormErrors).length === 0;
  useEffect(() => {
    if (submitState.status !== 'ok' || !submitState.detail) return;
    showFeedback(submitState.detail, 'success');
    setSubmitState({ status: 'idle', detail: '' });
  }, [showFeedback, submitState]);
  useEffect(() => {
    if (submitState.status === 'error' && submitState.detail) {
      showFeedback(submitState.detail, 'error');
      setSubmitState((prev) => (prev.status === 'error' ? { status: 'idle', detail: '' } : prev));
    }
  }, [showFeedback, submitState]);
  useEffect(() => {
    if (landlordsState.status === 'error' && landlordsState.detail) {
      showFeedback(landlordsState.detail, 'error');
    }
  }, [landlordsState.detail, landlordsState.status, showFeedback]);

  useEffect(() => {
    if (tiersState.status === 'error' && tiersState.detail) {
      showFeedback(tiersState.detail, 'error');
    }
  }, [tiersState.detail, tiersState.status, showFeedback]);

  const onToggleActive = async (landlordId, active) => {
    if (!canUseModule || !baseUrl) return;
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await patchResource(
        baseUrl,
        accessToken,
        `/api/portal/admin/landlords/${landlordId}`,
        { active }
      );
      setSubmitState({
        status: 'ok',
        detail: active
          ? t('portalAdminLandlords.messages.reactivated')
          : t('portalAdminLandlords.messages.deactivated'),
      });
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.saveFailed');
      setSubmitState({ status: 'error', detail });
    }
  };

  const openConfirmDialog = (landlord, activate) => {
    setConfirmDialog({
      open: true,
      landlordId: landlord.id,
      activate,
      name: displayName(landlord),
    });
  };

  const handleConfirmToggle = () => {
    const { landlordId, activate } = confirmDialog;
    setConfirmDialog({ open: false, landlordId: null, activate: false, name: '' });
    void onToggleActive(landlordId, activate);
  };

  const openTierDialog = (landlord) => {
    const { tier_id } = pickLandlordTierFields(landlord);
    const fallbackId = tiersState.tiers[0]?.id != null ? String(tiersState.tiers[0].id) : '';
    setTierDialog({
      open: true,
      landlord,
      selectedTierId: tier_id || fallbackId,
    });
  };

  const closeTierDialog = () => {
    setTierDialog({ open: false, landlord: null, selectedTierId: '' });
  };

  const onTierDialogSave = async () => {
    if (!canUseModule || !baseUrl || !tierDialog.landlord?.id || !tierDialog.selectedTierId) {
      showFeedback(t('portalAdminLandlords.errors.tierPickRequired'), 'error');
      return;
    }
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await patchResource(
        baseUrl,
        accessToken,
        `/api/portal/admin/landlords/${tierDialog.landlord.id}/tier`,
        { tier_id: tierDialog.selectedTierId }
      );
      setSubmitState({
        status: 'ok',
        detail: t('portalAdminLandlords.messages.tierUpdated'),
      });
      closeTierDialog();
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      setSubmitState({
        status: 'error',
        detail: toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.tierSaveFailed'),
      });
    }
  };

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitState.status !== 'saving') {
      setSubmitState({ status: 'idle', detail: '' });
    }
  };

  const onBlur = (field) => (event) => {
    const message = validatePersonField(field, event.target.value, t, {
      keys: {
        firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
        lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
        emailRequired: 'portalAdminLandlords.errors.emailRequired',
        emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
      },
    });
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const beginEdit = (landlord) => {
    setEditingLandlordId(landlord.id);
    setEditForm({
      email: String(landlord.email ?? ''),
      firstName: String(landlord.first_name ?? ''),
      lastName: String(landlord.last_name ?? ''),
      phone: String(landlord.phone ?? ''),
    });
    setEditFieldErrors({});
  };

  const cancelEdit = () => {
    setEditingLandlordId(null);
    setEditForm({ email: '', firstName: '', lastName: '', phone: '' });
    setEditFieldErrors({});
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setFieldErrors({});
    setForm({ email: '', firstName: '', lastName: '', phone: '', tierId: '' });
  };

  const onEditChange = (field) => (event) => {
    const value = event.target.value;
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitState.status !== 'saving') {
      setSubmitState({ status: 'idle', detail: '' });
    }
  };

  const onEditBlur = (field) => (event) => {
    const message = validatePersonField(field, event.target.value, t, {
      keys: {
        firstNameRequired: 'portalAdminLandlords.errors.firstNameRequired',
        lastNameRequired: 'portalAdminLandlords.errors.lastNameRequired',
        emailRequired: 'portalAdminLandlords.errors.emailRequired',
        emailInvalid: 'portalAdminLandlords.errors.emailInvalid',
      },
    });
    setEditFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const onEditSubmit = async (event) => {
    event.preventDefault();
    if (!canUseModule || !baseUrl || !editingLandlordId) return;
    if (!isEditFormValid) {
      setEditFieldErrors(editFormErrors);
      setSubmitState({
        status: 'error',
        detail: t('portalAdminLandlords.errors.validation'),
      });
      return;
    }
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      await patchResource(
        baseUrl,
        accessToken,
        `/api/portal/admin/landlords/${editingLandlordId}`,
        {
          email: editForm.email.trim().toLowerCase(),
          first_name: editForm.firstName.trim(),
          last_name: editForm.lastName.trim(),
          phone: editForm.phone.trim() || null,
        }
      );
      setSubmitState({
        status: 'ok',
        detail: t('portalAdminLandlords.messages.landlordUpdated'),
      });
      cancelEdit();
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.saveFailed');
      setSubmitState({ status: 'error', detail });
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canUseModule || !baseUrl) return;
    if (!isFormValid) {
      setFieldErrors(formErrors);
      setSubmitState({
        status: 'error',
        detail: t('portalAdminLandlords.errors.validation'),
      });
      return;
    }
    if (!createPlanChoiceOk) {
      if (tiersState.status === 'ok' && tiersState.tiers.length > 0) {
        setFieldErrors((prev) => ({
          ...prev,
          tierId: t('portalAdminLandlords.errors.tierPickRequired'),
        }));
      }
      setSubmitState({
        status: 'error',
        detail: t('portalAdminLandlords.errors.tierPickRequired'),
      });
      return;
    }
    const email = form.email.trim().toLowerCase();
    setSubmitState({ status: 'saving', detail: '' });
    try {
      const accessToken = await getAccessToken();
      const tierTrimmed = String(form.tierId ?? '').trim();
      const payload = {
        email,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || null,
      };
      if (tierTrimmed) {
        payload.tier_id = tierTrimmed;
      }
      await createLandlord(baseUrl, accessToken, payload);
      setSubmitState({
        status: 'ok',
        detail: t('portalAdminLandlords.messages.landlordSaved'),
      });
      setFieldErrors({});
      setForm({ email: '', firstName: '', lastName: '', phone: '', tierId: '' });
      setCreateDialogOpen(false);
      void loadLandlords();
    } catch (error) {
      handleApiForbidden(error);
      const detail = toFriendlyErrorMessage(t, 'portalAdminLandlords.errors.saveFailed');
      setSubmitState({ status: 'error', detail });
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminLandlords.title')}</title>
        <meta name="description" content={t('portalAdminLandlords.metaDescription')} />
      </Helmet>
      <Stack spacing={2}>
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {landlordHighlightAnnouncement}
        </Box>
        <Typography variant="h1" sx={{ fontSize: '2rem' }}>
          {t('portalAdminLandlords.heading')}
        </Typography>
        <Typography color="text.secondary">{t('portalAdminLandlords.intro')}</Typography>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalAdminLandlords.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalAdminLandlords.errors.signInRequired') } : null}
        />
        {isAuthenticated && meStatus !== 'loading' && !isAdmin && (
          <StatusAlertSlot message={{ severity: 'error', text: t('portalAdminLandlords.errors.adminOnly') }} />
        )}

        <Box>
          <Button
            type="button"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!canUseModule}
            onClick={() => {
              setForm((prev) => ({ ...prev, tierId: '' }));
              setFieldErrors((prev) => ({ ...prev, tierId: '' }));
              setCreateDialogOpen(true);
            }}
          >
            {t('portalAdminLandlords.form.showForm')}
          </Button>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2.5,
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
                {t('portalAdminLandlords.list.heading')}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={(
                    <Switch
                      size="small"
                      checked={showInactive}
                      onChange={(event) => setShowInactive(event.target.checked)}
                      disabled={!canUseModule || landlordsState.status === 'loading'}
                    />
                  )}
                  label={t('portalAdminLandlords.list.showInactive')}
                  sx={{ mr: 0 }}
                />
                <PortalRefreshButton
                  label={t('portalAdminLandlords.list.refreshLandlordList')}
                  onClick={() => void loadLandlords()}
                  disabled={!canUseModule}
                  loading={landlordsState.status === 'loading'}
                />
              </Stack>
            </Stack>
            {landlordsState.status === 'loading' && landlordsState.landlords.length === 0 && (
              <Typography color="text.secondary">{t('portalAdminLandlords.list.loading')}</Typography>
            )}
            <StatusAlertSlot
              message={landlordsState.status === 'error'
                ? { severity: 'error', text: landlordsState.detail }
                : null}
            />
            {landlordsState.status !== 'loading' && landlordsState.landlords.length === 0 && (
              <EmptyState
                icon={<SupervisorAccountIcon sx={{ fontSize: 56 }} />}
                title={t('portalAdminLandlords.list.emptyTitle')}
                description={t('portalAdminLandlords.list.emptyDescription')}
                actionLabel={canUseModule ? t('portalAdminLandlords.list.emptyAction') : undefined}
                onAction={canUseModule ? () => {
                  setForm((prev) => ({ ...prev, tierId: '' }));
                  setFieldErrors((prev) => ({ ...prev, tierId: '' }));
                  setCreateDialogOpen(true);
                } : undefined}
              />
            )}
            {sortedLandlords.map((landlord) => (
              <Box
                key={landlord.id}
                id={`landlord-row-${landlord.id}`}
                {...getLandlordHighlightProps(landlord.id)}
                sx={{
                  border: '1px solid',
                  borderColor:
                    flashLandlordId && String(landlord.id) === String(flashLandlordId)
                      ? 'primary.main'
                      : 'divider',
                  borderRadius: 1.5,
                  p: 1.5,
                  boxShadow:
                    flashLandlordId && String(landlord.id) === String(flashLandlordId)
                      ? (theme) => `0 0 0 3px ${theme.palette.primary.main}40`
                      : 'none',
                  backgroundColor:
                    flashLandlordId && String(landlord.id) === String(flashLandlordId)
                      ? 'action.selected'
                      : 'transparent',
                  transition: 'box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                    <PortalUserAvatar
                      photoUrl={String(landlord.profile_photo_url ?? '').trim()}
                      firstName={landlord.first_name ?? ''}
                      lastName={landlord.last_name ?? ''}
                      size={44}
                      sx={{ flexShrink: 0, mt: 0.125 }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 600 }}>{displayName(landlord)}</Typography>
                        <Chip
                          label={isActiveStatus(landlord.status)
                            ? t('portalTenants.status.active')
                            : t('portalTenants.status.disabled')}
                          size="small"
                          color={isActiveStatus(landlord.status) ? 'success' : 'default'}
                          variant={isActiveStatus(landlord.status) ? 'filled' : 'outlined'}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        <MailtoEmailLink email={landlord.email} color="inherit" sx={{ color: 'inherit' }} />
                      </Typography>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ fontWeight: 600 }}>
                          {t('portalAdminLandlords.list.tier')}
                        </Typography>
                        {(() => {
                          const tf = pickLandlordTierFields(landlord);
                          const chipLabel = tf.tier_display_name ?? t('portalAdminLandlords.list.tierNone');
                          return (
                            <Chip
                              label={chipLabel}
                              size="small"
                              color={tierChipColor(tf.tier_name)}
                              variant="outlined"
                              sx={{ maxWidth: '100%' }}
                              aria-label={t('portalAdminLandlords.list.tierChipAria', { tier: chipLabel })}
                            />
                          );
                        })()}
                        <Tooltip title={t('portalAdminLandlords.actions.changeTier')}>
                          <span>
                            <IconButton
                              type="button"
                              size="small"
                              onClick={() => openTierDialog(landlord)}
                              aria-label={t('portalAdminLandlords.actions.changeTier')}
                              disabled={!canUseModule || submitState.status === 'saving' || tiersState.status !== 'ok'}
                              color="primary"
                            >
                              <LayersOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', flexShrink: 0, alignItems: 'center' }}>
                    <Tooltip title={t('portalAdminLandlords.actions.edit')}>
                      <span>
                        <IconButton
                          type="button"
                          size="small"
                          color="primary"
                          onClick={() => beginEdit(landlord)}
                          aria-label={t('portalAdminLandlords.actions.edit')}
                          disabled={!canUseModule || submitState.status === 'saving'}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('portalAdminLandlords.actions.exportContactCard')}>
                      <span>
                        <IconButton
                          type="button"
                          size="small"
                          color="info"
                          onClick={() => {
                            const ok = exportLandlordContactVCard(landlord, t);
                            if (!ok) {
                              showFeedback(t('portalAdminLandlords.errors.exportContactCardFailed'), 'error');
                            }
                          }}
                          aria-label={t('portalAdminLandlords.actions.exportContactCard')}
                          disabled={!canUseModule || submitState.status === 'saving'}
                        >
                          <ContactPageIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    {String(landlord.status ?? '').toUpperCase() === 'DISABLED' ? (
                      <Tooltip title={t('portalAdminLandlords.actions.reactivate')}>
                        <span>
                          <IconButton
                            type="button"
                            size="small"
                            color="success"
                            onClick={() => openConfirmDialog(landlord, true)}
                            aria-label={t('portalAdminLandlords.actions.reactivate')}
                            disabled={!canUseModule || submitState.status === 'saving'}
                          >
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip title={t('portalAdminLandlords.actions.deactivate')}>
                        <span>
                          <IconButton
                            type="button"
                            size="small"
                            color="warning"
                            onClick={() => openConfirmDialog(landlord, false)}
                            aria-label={t('portalAdminLandlords.actions.deactivate')}
                            disabled={!canUseModule || submitState.status === 'saving'}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>

      <Dialog
        open={tierDialog.open}
        onClose={submitState.status === 'saving' ? undefined : closeTierDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {t('portalAdminLandlords.tierDialog.title', {
            name: tierDialog.landlord ? displayName(tierDialog.landlord) : '',
          })}
        </DialogTitle>
        <DialogContent dividers>
          {tiersState.status === 'error' && (
            <Typography color="error" variant="body2" sx={{ mb: 1 }}>
              {tiersState.detail}
            </Typography>
          )}
          {tiersState.status === 'loading' && (
            <Typography color="text.secondary" variant="body2">
              {t('portalAdminLandlords.tierDialog.loadingTiers')}
            </Typography>
          )}
          {tiersState.status === 'ok' && (
            <FormControl fullWidth margin="dense">
              <InputLabel id="admin-landlord-tier-select-label">
                {t('portalAdminLandlords.tierDialog.selectLabel')}
              </InputLabel>
              <Select
                labelId="admin-landlord-tier-select-label"
                label={t('portalAdminLandlords.tierDialog.selectLabel')}
                value={tierDialog.selectedTierId}
                onChange={(e) => setTierDialog((prev) => ({ ...prev, selectedTierId: e.target.value }))}
              >
                {tiersState.tiers.map((tier) => (
                  <MenuItem key={String(tier.id)} value={String(tier.id)}>
                    {String(tier.display_name ?? tier.name ?? tier.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={closeTierDialog} disabled={submitState.status === 'saving'}>
            {t('portalAdminLandlords.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => void onTierDialogSave()}
            disabled={
              submitState.status === 'saving'
              || tiersState.status !== 'ok'
              || !tierDialog.selectedTierId
            }
          >
            {submitState.status === 'saving'
              ? t('portalAdminLandlords.form.sending')
              : t('portalAdminLandlords.tierDialog.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <PortalConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmToggle}
        title={
          confirmDialog.activate
            ? t('portalAdminLandlords.confirmReactivate.title')
            : t('portalAdminLandlords.confirmDeactivate.title')
        }
        body={
          confirmDialog.activate
            ? t('portalAdminLandlords.confirmReactivate.body', { name: confirmDialog.name })
            : t('portalAdminLandlords.confirmDeactivate.body', { name: confirmDialog.name })
        }
        confirmLabel={
          confirmDialog.activate
            ? t('portalAdminLandlords.actions.reactivate')
            : t('portalAdminLandlords.actions.deactivate')
        }
        cancelLabel={t('portalAdminLandlords.actions.cancel')}
        confirmColor={confirmDialog.activate ? 'primary' : 'warning'}
      />
      <Dialog
        open={createDialogOpen}
        onClose={submitState.status === 'saving' ? undefined : closeCreateDialog}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={onSubmit}>
          <DialogTitle>{t('portalAdminLandlords.form.heading')}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <TextField
                label={t('portalAdminLandlords.form.email')}
                value={form.email}
                onChange={onChange('email')}
                onBlur={onBlur('email')}
                required
                type="email"
                autoComplete="email"
                error={Boolean(fieldErrors.email)}
                helperText={fieldErrors.email || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.firstName')}
                value={form.firstName}
                onChange={onChange('firstName')}
                onBlur={onBlur('firstName')}
                required
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.lastName')}
                value={form.lastName}
                onChange={onChange('lastName')}
                onBlur={onBlur('lastName')}
                required
                error={Boolean(fieldErrors.lastName)}
                helperText={fieldErrors.lastName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.phone')}
                value={form.phone}
                onChange={onChange('phone')}
                helperText=" "
                fullWidth
                autoComplete="tel"
              />
              {tiersState.status === 'error' && (
                <Alert severity="info">
                  {t('portalAdminLandlords.form.tierFallbackNotice')}
                </Alert>
              )}
              {tiersState.status === 'loading' && (
                <Typography color="text.secondary" variant="body2">
                  {t('portalAdminLandlords.form.tierLoading')}
                </Typography>
              )}
              {tiersState.status === 'ok' && tiersState.tiers.length > 0 && (
                <FormControl fullWidth required error={Boolean(fieldErrors.tierId)}>
                  <InputLabel id="admin-landlord-create-tier-label" shrink>
                    {t('portalAdminLandlords.form.tierLabel')}
                  </InputLabel>
                  <Select
                    labelId="admin-landlord-create-tier-label"
                    label={t('portalAdminLandlords.form.tierLabel')}
                    value={form.tierId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({ ...prev, tierId: value }));
                      setFieldErrors((prev) => ({ ...prev, tierId: '' }));
                      if (submitState.status !== 'saving') {
                        setSubmitState({ status: 'idle', detail: '' });
                      }
                    }}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>{t('portalAdminLandlords.form.tierPlaceholder')}</em>
                    </MenuItem>
                    {tiersState.tiers.map((tier) => (
                      <MenuItem key={String(tier.id)} value={String(tier.id)}>
                        {String(tier.display_name ?? tier.name ?? tier.id)}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText error={Boolean(fieldErrors.tierId)}>
                    {fieldErrors.tierId || ' '}
                  </FormHelperText>
                </FormControl>
              )}
              {tiersState.status === 'ok' && tiersState.tiers.length === 0 && (
                <Alert severity="info">
                  {t('portalAdminLandlords.form.tierFallbackNotice')}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={closeCreateDialog}
              disabled={submitState.status === 'saving'}
            >
              {t('portalAdminLandlords.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canUseModule || submitState.status === 'saving' || !canSubmitCreate}
            >
              {submitState.status === 'saving'
                ? t('portalAdminLandlords.form.sending')
                : t('portalAdminLandlords.form.saveLandlord')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={Boolean(editingLandlordId)}
        onClose={submitState.status === 'saving' ? undefined : cancelEdit}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={onEditSubmit}>
          <DialogTitle>{t('portalAdminLandlords.form.editHeading')}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <TextField
                label={t('portalAdminLandlords.form.email')}
                value={editForm.email}
                onChange={onEditChange('email')}
                onBlur={onEditBlur('email')}
                required
                type="email"
                autoComplete="email"
                error={Boolean(editFieldErrors.email)}
                helperText={editFieldErrors.email || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.firstName')}
                value={editForm.firstName}
                onChange={onEditChange('firstName')}
                onBlur={onEditBlur('firstName')}
                required
                error={Boolean(editFieldErrors.firstName)}
                helperText={editFieldErrors.firstName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.lastName')}
                value={editForm.lastName}
                onChange={onEditChange('lastName')}
                onBlur={onEditBlur('lastName')}
                required
                error={Boolean(editFieldErrors.lastName)}
                helperText={editFieldErrors.lastName || ' '}
                fullWidth
              />
              <TextField
                label={t('portalAdminLandlords.form.phone')}
                value={editForm.phone}
                onChange={onEditChange('phone')}
                fullWidth
                autoComplete="tel"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={cancelEdit}
              disabled={submitState.status === 'saving'}
            >
              {t('portalAdminLandlords.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canUseModule || submitState.status === 'saving' || !isEditFormValid}
            >
              {submitState.status === 'saving'
                ? t('portalAdminLandlords.form.sending')
                : t('portalAdminLandlords.actions.saveChanges')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Box>
  );
};

export default PortalAdminLandlords;
