import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useBeforeUnload, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { usePortalAuth } from '../PortalAuthContext';
import { useLanguage } from '../LanguageContext';
import { useThemeMode } from '../ThemeModeContext';
import { FEATURE_DARK_THEME } from '../featureFlags';
import { emailFromAccount, isGuestRole, normalizeRole, profilePhotoUrlFromMeData, resolveRole } from '../portalUtils';
import { validatePersonBasics, validatePersonField } from '../portalPersonValidation';
import {
  patchProfile,
  postProfilePhotoUploadIntent,
  finalizeProfilePhoto,
  deleteProfilePhoto,
  putBlobToStorage,
} from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalConfirmDialog from './PortalConfirmDialog';
import PortalUserAvatar from './PortalUserAvatar';
import ProfilePhotoEditorDialog from './ProfilePhotoEditorDialog';
import StatusAlertSlot from './StatusAlertSlot';
import PortalProfileFlowMatrix from './PortalProfileFlowMatrix';
import { PROFILE_PHOTO_OUTPUT_MAX_BYTES } from '../profilePhotoConstants.js';
import { maxImageBytesFromMeData, maxImageMbForDisplay } from '../attachmentUploadLimits.js';

function validateProfileForm(form, t) {
  return validatePersonBasics(form, t, {
    keys: {
      firstNameRequired: 'portalProfile.errors.firstNameRequired',
      lastNameRequired: 'portalProfile.errors.lastNameRequired',
      emailRequired: 'portalProfile.errors.emailInvalid',
      emailInvalid: 'portalProfile.errors.emailInvalid',
      phoneRequired: 'portalProfile.errors.phoneRequiredForSms',
      phoneInvalid: 'portalProfile.errors.phoneInvalid',
    },
    requirePhone: Boolean(form?.notificationsSmsEnabled),
  });
}

function validateProfileFieldSingle(field, value, t, options = {}) {
  return validatePersonField(field, value, t, {
    keys: {
      firstNameRequired: 'portalProfile.errors.firstNameRequired',
      lastNameRequired: 'portalProfile.errors.lastNameRequired',
      emailRequired: 'portalProfile.errors.emailInvalid',
      emailInvalid: 'portalProfile.errors.emailInvalid',
      phoneRequired: 'portalProfile.errors.phoneRequiredForSms',
      phoneInvalid: 'portalProfile.errors.phoneInvalid',
    },
    requirePhone: Boolean(options.requirePhone),
  });
}

function profilePhotoErrorMessage(code, t, pickMaxMb) {
  const c = typeof code === 'string' ? code : '';
  const maxMb = pickMaxMb ?? maxImageMbForDisplay(maxImageBytesFromMeData(undefined));
  if (c === 'invalid_profile_photo_content_type') return t('portalProfile.photoErrors.invalidType');
  if (c === 'profile_photo_too_large') return t('portalProfile.photoErrors.tooLarge', { maxMb });
  if (c === 'attachment_config_missing') return t('portalProfile.photoErrors.attachmentConfigUnavailable');
  if (c === 'storage_not_configured') return t('portalProfile.photoErrors.storageUnavailable');
  return t('portalProfile.photoErrors.uploadFailed');
}

/** Full-width rows so email / in-app / SMS switches share one column (Tooltip SMS row matches). */
const notificationPreferenceLabelSx = {
  m: 0,
  mx: 0,
  width: '100%',
  alignItems: 'flex-start',
  gap: 1,
};

const notificationPreferenceSwitchSx = { mt: 0.25 };

const PortalProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    meStatus,
    getAccessToken,
    handleApiForbidden,
    refreshMe,
  } = usePortalAuth();
  const { storedLanguageOverride, changeLanguage, resetLanguagePreference, supportedLanguages } = useLanguage();
  const { storedOverride, setOverrideDark, setOverrideLight, resetOverride } = useThemeMode();
  const role = resolveRole(meData, account);

  // Pending appearance state — changes accumulate locally and only persist on Save.
  const [pendingLanguage, setPendingLanguage] = useState(null); // null = 'system' / use device
  const [pendingTheme, setPendingTheme] = useState(null); // null = 'system' / use device
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    notificationsEmailEnabled: true,
    notificationsInAppEnabled: true,
    notificationsSmsEnabled: false,
    notificationsSmsOptIn: false,
  });
  // Map<event_type_code, { email_enabled, in_app_enabled, sms_enabled }>
  // null/undefined channel values mean "use the compile-time default".
  const [flowOverrides, setFlowOverrides] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [smsOptInConfirmOpen, setSmsOptInConfirmOpen] = useState(false);
  const smsNotificationsAllowed = meData?.user?.sms_notifications_allowed !== false;
  const [removePhotoConfirmOpen, setRemovePhotoConfirmOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const fileInputRef = useRef(null);
  const shouldWarnLeaveRef = useRef(false);
  const leaveConfirmOpenRef = useRef(false);
  const pendingNavigationRef = useRef('');
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const initialForm = useMemo(() => {
    const tierAllowsSms = meData?.user?.sms_notifications_allowed !== false;
    const dbSmsOn =
      Boolean(meData?.user?.notification_preferences?.sms_enabled)
      && Boolean(meData?.user?.notification_preferences?.sms_opt_in);
    return {
      email: meData?.user?.email ?? '',
      firstName: meData?.user?.first_name ?? '',
      lastName: meData?.user?.last_name ?? '',
      phone: meData?.user?.phone ?? '',
      notificationsEmailEnabled: meData?.user?.notification_preferences?.email_enabled ?? true,
      notificationsInAppEnabled: meData?.user?.notification_preferences?.in_app_enabled ?? true,
      notificationsSmsEnabled: tierAllowsSms && dbSmsOn,
      notificationsSmsOptIn: tierAllowsSms && dbSmsOn,
    };
  }, [meData]);
  const flowCatalog = useMemo(
    () => Array.isArray(meData?.user?.notification_flow_catalog)
      ? meData.user.notification_flow_catalog
      : [],
    [meData?.user?.notification_flow_catalog]
  );
  const initialFlowOverrides = useMemo(() => {
    const map = {};
    const list = meData?.user?.notification_flow_preferences;
    if (Array.isArray(list)) {
      for (const p of list) {
        if (!p?.event_type_code) continue;
        map[p.event_type_code] = {
          email_enabled: p.email_enabled ?? null,
          in_app_enabled: p.in_app_enabled ?? null,
          sms_enabled: p.sms_enabled ?? null,
        };
      }
    }
    return map;
  }, [meData?.user?.notification_flow_preferences]);
  // Server-side appearance values (DB) — used as the baseline for change detection.
  const initialAppearance = useMemo(() => ({
    language: meData?.user?.ui_language ?? null,
    theme: meData?.user?.ui_color_scheme ?? null,
  }), [meData?.user?.ui_language, meData?.user?.ui_color_scheme]);

  const flowOverridesChanged = useMemo(() => {
    const keys = new Set([
      ...Object.keys(flowOverrides),
      ...Object.keys(initialFlowOverrides),
    ]);
    for (const code of keys) {
      const cur = flowOverrides[code] || {};
      const base = initialFlowOverrides[code] || {};
      if ((cur.email_enabled ?? null) !== (base.email_enabled ?? null)) return true;
      if ((cur.in_app_enabled ?? null) !== (base.in_app_enabled ?? null)) return true;
      if ((cur.sms_enabled ?? null) !== (base.sms_enabled ?? null)) return true;
    }
    return false;
  }, [flowOverrides, initialFlowOverrides]);

  const hasChanges = useMemo(
    () =>
      form.email !== initialForm.email
      || form.firstName !== initialForm.firstName
      || form.lastName !== initialForm.lastName
      || form.phone !== initialForm.phone
      || form.notificationsEmailEnabled !== initialForm.notificationsEmailEnabled
      || form.notificationsInAppEnabled !== initialForm.notificationsInAppEnabled
      || form.notificationsSmsEnabled !== initialForm.notificationsSmsEnabled
      || form.notificationsSmsOptIn !== initialForm.notificationsSmsOptIn
      || pendingLanguage !== initialAppearance.language
      || pendingTheme !== initialAppearance.theme
      || flowOverridesChanged,
    [form, initialForm, pendingLanguage, pendingTheme, initialAppearance, flowOverridesChanged]
  );

  const shouldWarnLeave = hasChanges && saveStatus !== 'saving';
  shouldWarnLeaveRef.current = shouldWarnLeave;
  leaveConfirmOpenRef.current = leaveConfirmOpen;

  useBeforeUnload(
    useCallback((event) => {
      if (!shouldWarnLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }, [])
  );

  useEffect(() => {
    const onDocumentClickCapture = (event) => {
      if (!shouldWarnLeaveRef.current || leaveConfirmOpenRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const el = event.target;
      if (!(el instanceof Element)) return;
      if (el.closest('.MuiDialog-root, .MuiModal-root')) return;

      const anchor = el.closest('a[href]');
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      let nextUrl;
      try {
        nextUrl = new URL(anchor.href);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;

      const currentKey = `${location.pathname}${location.search}`;
      const nextKey = `${nextUrl.pathname}${nextUrl.search}`;
      if (currentKey === nextKey) return;

      event.preventDefault();
      event.stopPropagation();
      const to = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      pendingNavigationRef.current = to;
      setLeaveConfirmOpen(true);
    };

    document.addEventListener('click', onDocumentClickCapture, true);
    return () => document.removeEventListener('click', onDocumentClickCapture, true);
  }, [location.pathname, location.search]);

  useEffect(() => {
    setForm(initialForm);
    setFieldErrors({});
  }, [initialForm]);

  useEffect(() => {
    setFlowOverrides(initialFlowOverrides);
  }, [initialFlowOverrides]);

  // Req 6: On mount (per user), read DB values and override browser storage if different.
  // Also initialises the pending dropdowns from the server so the profile page always
  // reflects the latest server-stored preferences, not just whatever is in localStorage.
  const meUserId = meData?.user?.id;
  useEffect(() => {
    if (!meData?.user) return;
    // Guests never have server-stored preferences; skip.
    if (isGuestRole(normalizeRole(resolveRole(meData, account)))) return;

    const dbLang = meData.user.ui_language ?? null;
    const dbTheme = meData.user.ui_color_scheme ?? null;

    // Initialise pending dropdowns with DB values.
    setPendingLanguage(dbLang);
    setPendingTheme(dbTheme);

    // Override localStorage with server value if they differ, then show a notice.
    let overridden = false;
    if (dbLang !== storedLanguageOverride) {
      if (dbLang !== null) void changeLanguage(dbLang);
      else void resetLanguagePreference();
      overridden = true;
    }
    if (FEATURE_DARK_THEME && dbTheme !== storedOverride) {
      if (dbTheme === 'dark') setOverrideDark();
      else if (dbTheme === 'light') setOverrideLight();
      else resetOverride();
      overridden = true;
    }
    if (overridden) {
      showFeedback(t('portalProfile.preferencesRefreshed'), 'info');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meUserId]);
  useEffect(() => {
    if (saveStatus === 'success') {
      showFeedback(t('portalProfile.saved'));
    }
  }, [saveStatus, showFeedback, t]);
  useEffect(() => {
    if (saveStatus === 'error') {
      showFeedback(saveError || t('portalProfile.errors.unknown'), 'error');
    }
  }, [saveError, saveStatus, showFeedback, t]);

  const onChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setSaveStatus('idle');
    setSaveError('');
  };
  const onBlur = (field) => (event) => {
    const message = validateProfileFieldSingle(field, event.target.value, t, {
      requirePhone: Boolean(form.notificationsSmsEnabled),
    });
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };
  const onToggle = (field) => (event) => {
    if (field === 'notificationsSmsEnabled') {
      const checked = event.target.checked;
      if (checked) {
        setSmsOptInConfirmOpen(true);
      } else {
        setForm((prev) => ({
          ...prev,
          notificationsSmsEnabled: false,
          notificationsSmsOptIn: false,
        }));
      }
      setSaveStatus('idle');
      setSaveError('');
      return;
    }
    setForm((prev) => ({ ...prev, [field]: event.target.checked }));
    setSaveStatus('idle');
    setSaveError('');
  };
  const confirmSmsOptIn = () => {
    setForm((prev) => ({
      ...prev,
      notificationsSmsEnabled: true,
      notificationsSmsOptIn: true,
    }));
    setSaveStatus('idle');
    setSaveError('');
    setSmsOptInConfirmOpen(false);
  };
  const cancelSmsOptIn = () => {
    setSmsOptInConfirmOpen(false);
  };

  const onFlowChannelChange = useCallback((eventTypeCode, channel, value) => {
    setSaveStatus('idle');
    setSaveError('');
    setFlowOverrides((prev) => {
      const next = { ...prev };
      const key = channel === 'email' ? 'email_enabled' : channel === 'in_app' ? 'in_app_enabled' : 'sms_enabled';
      const current = next[eventTypeCode] || {
        email_enabled: null,
        in_app_enabled: null,
        sms_enabled: null,
      };
      const updated = { ...current, [key]: value };
      // If every channel is back to null (match default), drop the entry.
      if (
        updated.email_enabled === null
        && updated.in_app_enabled === null
        && updated.sms_enabled === null
      ) {
        delete next[eventTypeCode];
      } else {
        next[eventTypeCode] = updated;
      }
      return next;
    });
  }, []);

  const confirmLeaveProfile = useCallback(() => {
    const to = pendingNavigationRef.current;
    pendingNavigationRef.current = '';
    setLeaveConfirmOpen(false);
    if (to) navigate(to);
  }, [navigate]);

  const cancelLeaveProfile = useCallback(() => {
    pendingNavigationRef.current = '';
    setLeaveConfirmOpen(false);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateProfileForm(form, t);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setSaveStatus('error');
      setSaveError(t('portalProfile.errors.validation'));
      return;
    }
    if (!hasChanges) {
      setSaveStatus('idle');
      setSaveError('');
      return;
    }
    setSaveStatus('saving');
    setSaveError('');
    try {
      if (!isAuthenticated) {
        throw new Error(t('portalProfile.errors.signInRequired'));
      }
      if (!baseUrl) {
        throw new Error(t('portalProfile.errors.apiUnavailable'));
      }
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const normalizedEmail = form.email.trim().toLowerCase();
      const tierAllowsSms = meData?.user?.sms_notifications_allowed !== false;
      const flowPayload = Object.entries(flowOverrides).map(([code, ov]) => ({
        event_type_code: code,
        email_enabled: ov.email_enabled ?? null,
        in_app_enabled: ov.in_app_enabled ?? null,
        sms_enabled: ov.sms_enabled ?? null,
      }));
      // Also send cleared-back-to-default entries so the server drops their rows.
      for (const code of Object.keys(initialFlowOverrides)) {
        if (!flowOverrides[code]) {
          flowPayload.push({
            event_type_code: code,
            email_enabled: null,
            in_app_enabled: null,
            sms_enabled: null,
          });
        }
      }
      const payload = await patchProfile(baseUrl, token, {
        emailHint,
        email: normalizedEmail,
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        notification_preferences: {
          email_enabled: form.notificationsEmailEnabled,
          in_app_enabled: form.notificationsInAppEnabled,
          sms_enabled: tierAllowsSms && form.notificationsSmsEnabled,
          sms_opt_in: tierAllowsSms && form.notificationsSmsOptIn,
        },
        notification_flow_preferences: flowPayload,
      });
      const savedUser = payload && typeof payload === 'object' ? payload.user : null;
      const savedPreferences = payload && typeof payload === 'object'
        ? payload.notification_preferences
        : null;
      const savedFlowPrefs = payload && typeof payload === 'object'
        ? payload.notification_flow_preferences
        : null;
      if (Array.isArray(savedFlowPrefs)) {
        const next = {};
        for (const p of savedFlowPrefs) {
          if (!p?.event_type_code) continue;
          next[p.event_type_code] = {
            email_enabled: p.email_enabled ?? null,
            in_app_enabled: p.in_app_enabled ?? null,
            sms_enabled: p.sms_enabled ?? null,
          };
        }
        setFlowOverrides(next);
      }
      if (savedUser && typeof savedUser === 'object') {
        setForm({
          email: typeof savedUser.email === 'string' ? savedUser.email : form.email,
          firstName: typeof savedUser.first_name === 'string' ? savedUser.first_name : form.firstName,
          lastName: typeof savedUser.last_name === 'string' ? savedUser.last_name : form.lastName,
          phone: typeof savedUser.phone === 'string' ? savedUser.phone : '',
          notificationsEmailEnabled:
            typeof savedPreferences?.email_enabled === 'boolean'
              ? savedPreferences.email_enabled
              : form.notificationsEmailEnabled,
          notificationsInAppEnabled:
            typeof savedPreferences?.in_app_enabled === 'boolean'
              ? savedPreferences.in_app_enabled
              : form.notificationsInAppEnabled,
          notificationsSmsEnabled:
            typeof savedPreferences?.sms_enabled === 'boolean'
              ? savedPreferences.sms_enabled
              : form.notificationsSmsEnabled,
          notificationsSmsOptIn:
            typeof savedPreferences?.sms_opt_in === 'boolean'
              ? savedPreferences.sms_opt_in
              : form.notificationsSmsOptIn,
        });
      }
      setSaveStatus('success');
      refreshMe({ force: true });

      // Apply pending language/theme to context + localStorage now that Save succeeded.
      // The preference sync hook will then push the new values to the server.
      if (pendingLanguage !== storedLanguageOverride) {
        if (pendingLanguage !== null) void changeLanguage(pendingLanguage);
        else void resetLanguagePreference();
      }
      if (FEATURE_DARK_THEME && pendingTheme !== storedOverride) {
        if (pendingTheme === 'dark') setOverrideDark();
        else if (pendingTheme === 'light') setOverrideLight();
        else resetOverride();
      }
    } catch (error) {
      handleApiForbidden(error);
      if (
        error
        && typeof error === 'object'
        && 'code' in error
      ) {
        if (error.code === 'email_already_in_use') {
          setFieldErrors({});
          setSaveStatus('idle');
          setSaveError('');
          showFeedback(t('portalProfile.errors.emailExists'), 'error');
          return;
        }
        if (error.code === 'sms_phone_required') {
          setFieldErrors((prev) => ({
            ...prev,
            phone: t('portalProfile.errors.phoneRequiredForSms'),
          }));
          setSaveStatus('error');
          setSaveError(t('portalProfile.errors.phoneRequiredForSms'));
          return;
        }
        if (error.code === 'sms_not_available') {
          setFieldErrors({});
          setSaveStatus('idle');
          setSaveError('');
          showFeedback(t('portalProfile.errors.smsNotOnPlan'), 'error');
          return;
        }
      }
      setSaveStatus('error');
      setSaveError(t('portalProfile.errors.unknown'));
    }
  };

  // Keep existing profile content visible during background /me refreshes.
  const isLoading = isAuthenticated && meStatus === 'loading' && !meData?.user;
  const roleResolved = isAuthenticated && meStatus !== 'loading';
  const isGuest = roleResolved && isGuestRole(role);
  const isProfileDataUnavailable = isAuthenticated && meStatus === 'ok' && !meData?.user;
  const formDisabled =
    !isAuthenticated || isGuest || !baseUrl || isProfileDataUnavailable || saveStatus === 'saving';
  const hasProfilePhoto = Boolean(profilePhotoUrlFromMeData(meData));
  const profilePhotoPickMaxBytes = maxImageBytesFromMeData(meData);
  const profilePhotoPickMaxMb = maxImageMbForDisplay(profilePhotoPickMaxBytes);

  const pickProfilePhoto = () => {
    fileInputRef.current?.click();
  };

  const onProfilePhotoSelected = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || formDisabled || photoBusy) return;
    if (file.size > profilePhotoPickMaxBytes) {
      showFeedback(t('portalProfile.photoErrors.sourceTooLarge', { maxMb: profilePhotoPickMaxMb }), 'error');
      return;
    }
    const ct = (file.type || '').trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(ct)) {
      showFeedback(t('portalProfile.photoErrors.invalidType'), 'error');
      return;
    }
    setPendingPhotoFile(file);
    setPhotoEditorOpen(true);
  };

  const closePhotoEditor = () => {
    setPhotoEditorOpen(false);
    setPendingPhotoFile(null);
  };

  const uploadProfilePhotoBlob = async (blob) => {
    if (blob.size > PROFILE_PHOTO_OUTPUT_MAX_BYTES) {
      showFeedback(t('portalProfile.photoErrors.outputTooLarge'), 'error');
      throw new Error('profile_photo_output_too_large');
    }
    const outFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
    setPhotoBusy(true);
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const intent = await postProfilePhotoUploadIntent(baseUrl, token, {
        emailHint,
        content_type: 'image/jpeg',
        file_size_bytes: outFile.size,
        filename: outFile.name,
      });
      await putBlobToStorage(intent.upload_url, outFile);
      await finalizeProfilePhoto(baseUrl, token, {
        emailHint,
        storage_path: intent.storage_path,
        content_type: 'image/jpeg',
        file_size_bytes: outFile.size,
      });
      refreshMe({ force: true });
      showFeedback(t('portalProfile.photoSaved'), 'success');
    } catch (error) {
      handleApiForbidden(error);
      const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
      showFeedback(profilePhotoErrorMessage(code, t, profilePhotoPickMaxMb), 'error');
      throw error;
    } finally {
      setPhotoBusy(false);
    }
  };

  const openRemovePhotoConfirm = () => {
    if (formDisabled || photoBusy || !hasProfilePhoto) return;
    setRemovePhotoConfirmOpen(true);
  };

  const cancelRemovePhotoConfirm = () => {
    setRemovePhotoConfirmOpen(false);
  };

  const confirmRemoveProfilePhoto = async () => {
    if (formDisabled || photoBusy || !hasProfilePhoto) return;
    setPhotoBusy(true);
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await deleteProfilePhoto(baseUrl, token, { emailHint });
      refreshMe({ force: true });
      showFeedback(t('portalProfile.photoRemoved'), 'success');
      setRemovePhotoConfirmOpen(false);
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalProfile.photoErrors.uploadFailed'), 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Box>
      <Helmet>
        <title>{t('portalProfile.title')}</title>
        <meta name="description" content={t('portalProfile.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        {/* Heading and photo: avatar beside title (same pattern as other portal headers) */}
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flexWrap: 'wrap' }}>
          <Box sx={{ flexShrink: 0 }}>
            <PortalUserAvatar
              meData={meData}
              firstName={form.firstName}
              lastName={form.lastName}
              fallbackPhotoUrl={account?.photoURL}
              onProfilePhotoLoadError={refreshMe}
              size={96}
            />
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
            <Typography variant="h5" component="h2" fontWeight={700}>
              {t('portalProfile.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('portalProfile.intro')}
            </Typography>
            {!isLoading && !isGuest && baseUrl && !isProfileDataUnavailable && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  aria-hidden
                  onChange={onProfilePhotoSelected}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  disabled={formDisabled || photoBusy}
                  onClick={pickProfilePhoto}
                  sx={{ textTransform: 'none' }}
                >
                  {photoBusy ? t('portalProfile.photoUploading') : t('portalProfile.changePhoto')}
                </Button>
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  disabled={formDisabled || photoBusy || !hasProfilePhoto}
                  onClick={openRemovePhotoConfirm}
                  sx={{ textTransform: 'none' }}
                >
                  {t('portalProfile.removePhoto')}
                </Button>
              </Stack>
            )}
          </Box>
        </Stack>

        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalProfile.errors.signInRequired') } : null}
        />
        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalProfile.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={isProfileDataUnavailable ? { severity: 'warning', text: t('portalProfile.dataUnavailable') } : null}
        />

        <Paper
          variant="outlined"
          component="form"
          noValidate
          onSubmit={onSubmit}
          sx={{ p: 3, borderRadius: 2 }}
        >
          <Stack spacing={2.5}>
            <StatusAlertSlot
              message={isGuest ? { severity: 'warning', text: t('portalProfile.guestBlocked') } : null}
            />
            {isLoading ? (
              <Stack spacing={2}>
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
              </Stack>
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label={t('portalProfile.fields.firstName')}
                    value={form.firstName}
                    onChange={onChange('firstName')}
                    onBlur={onBlur('firstName')}
                    autoComplete="given-name"
                    required
                    error={Boolean(fieldErrors.firstName)}
                    helperText={fieldErrors.firstName || ' '}
                    disabled={formDisabled}
                    fullWidth
                  />
                  <TextField
                    label={t('portalProfile.fields.lastName')}
                    value={form.lastName}
                    onChange={onChange('lastName')}
                    onBlur={onBlur('lastName')}
                    autoComplete="family-name"
                    required
                    error={Boolean(fieldErrors.lastName)}
                    helperText={fieldErrors.lastName || ' '}
                    disabled={formDisabled}
                    fullWidth
                  />
                </Stack>
                <TextField
                  label={t('portalProfile.fields.email')}
                  value={form.email}
                  onChange={onChange('email')}
                  onBlur={onBlur('email')}
                  autoComplete="email"
                  type="email"
                  required
                  error={Boolean(fieldErrors.email)}
                  helperText={fieldErrors.email || ' '}
                  disabled={formDisabled}
                />
                <TextField
                  label={t('portalProfile.fields.phone')}
                  value={form.phone}
                  onChange={onChange('phone')}
                  onBlur={onBlur('phone')}
                  autoComplete="tel"
                  type="tel"
                  required={Boolean(form.notificationsSmsEnabled)}
                  error={Boolean(fieldErrors.phone)}
                  helperText={fieldErrors.phone || ' '}
                  disabled={formDisabled}
                />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('portalProfile.fields.notificationsHeading')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                    <FormControlLabel
                      sx={notificationPreferenceLabelSx}
                      control={(
                        <Switch
                          checked={Boolean(form.notificationsEmailEnabled)}
                          onChange={onToggle('notificationsEmailEnabled')}
                          disabled={formDisabled}
                          sx={notificationPreferenceSwitchSx}
                        />
                      )}
                      label={t('portalProfile.fields.notificationsEmail')}
                    />
                    <FormControlLabel
                      sx={notificationPreferenceLabelSx}
                      control={(
                        <Switch
                          checked={Boolean(form.notificationsInAppEnabled)}
                          onChange={onToggle('notificationsInAppEnabled')}
                          disabled={formDisabled}
                          sx={notificationPreferenceSwitchSx}
                        />
                      )}
                      label={t('portalProfile.fields.notificationsInApp')}
                    />
                    <Tooltip
                      title={!smsNotificationsAllowed ? t('portalSubscription.freeTier.featureDisabled') : ''}
                    >
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          width: '100%',
                          maxWidth: '100%',
                          verticalAlign: 'top',
                        }}
                      >
                        <FormControlLabel
                          sx={{
                            ...notificationPreferenceLabelSx,
                            maxWidth: '100%',
                          }}
                          control={(
                            <Switch
                              checked={Boolean(form.notificationsSmsEnabled)}
                              onChange={onToggle('notificationsSmsEnabled')}
                              disabled={formDisabled || !smsNotificationsAllowed}
                              sx={notificationPreferenceSwitchSx}
                            />
                          )}
                          label={t('portalProfile.fields.notificationsSms')}
                        />
                      </Box>
                    </Tooltip>
                  </Box>
                </Stack>

                {flowCatalog.length > 0 && (
                  <PortalProfileFlowMatrix
                    catalog={flowCatalog}
                    overrides={flowOverrides}
                    globalPrefs={{
                      email: form.notificationsEmailEnabled,
                      in_app: form.notificationsInAppEnabled,
                      sms: form.notificationsSmsEnabled,
                    }}
                    smsAllowed={smsNotificationsAllowed}
                    smsOptedIn={Boolean(form.notificationsSmsOptIn)}
                    disabled={formDisabled}
                    onChange={onFlowChannelChange}
                  />
                )}

                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('portalProfile.fields.appearanceHeading')}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="portal-profile-language-label">
                        {t('portalProfile.fields.language')}
                      </InputLabel>
                      <Select
                        labelId="portal-profile-language-label"
                        value={pendingLanguage ?? 'system'}
                        label={t('portalProfile.fields.language')}
                        disabled={formDisabled}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPendingLanguage(v === 'system' ? null : v);
                        }}
                      >
                        <MenuItem value="system">{t('portalProfile.languages.system')}</MenuItem>
                        {supportedLanguages.map((lang) => (
                          <MenuItem key={lang} value={lang}>
                            {t(`portalProfile.languages.${lang}`)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {FEATURE_DARK_THEME && (
                      <FormControl fullWidth size="small">
                        <InputLabel id="portal-profile-theme-label">
                          {t('portalProfile.fields.colorTheme')}
                        </InputLabel>
                        <Select
                          labelId="portal-profile-theme-label"
                          value={pendingTheme ?? 'system'}
                          label={t('portalProfile.fields.colorTheme')}
                          disabled={formDisabled}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPendingTheme(v === 'system' ? null : v);
                          }}
                        >
                          <MenuItem value="system">{t('portalProfile.themes.system')}</MenuItem>
                          <MenuItem value="light">{t('portalProfile.themes.light')}</MenuItem>
                          <MenuItem value="dark">{t('portalProfile.themes.dark')}</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  </Stack>
                </Stack>

                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', rowGap: 1 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={formDisabled || !hasChanges}
                    sx={{ textTransform: 'none' }}
                  >
                    {saveStatus === 'saving' ? t('portalProfile.actions.saving') : t('portalProfile.actions.save')}
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
      <Dialog
        open={smsOptInConfirmOpen}
        onClose={cancelSmsOptIn}
        aria-labelledby="portal-profile-sms-optin-title"
      >
        <DialogTitle id="portal-profile-sms-optin-title">
          {t('portalProfile.smsOptInConfirm.title')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {t('portalProfile.smsOptInConfirm.body')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('portalProfile.smsOptInConfirm.saveReminder')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={cancelSmsOptIn}>
            {t('portalProfile.smsOptInConfirm.cancel')}
          </Button>
          <Button type="button" variant="contained" onClick={confirmSmsOptIn}>
            {t('portalProfile.smsOptInConfirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={leaveConfirmOpen}
        onClose={cancelLeaveProfile}
        aria-labelledby="portal-profile-unsaved-title"
      >
        <DialogTitle id="portal-profile-unsaved-title">
          {t('portalProfile.unsavedChanges.title')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('portalProfile.unsavedChanges.body')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={cancelLeaveProfile}>
            {t('portalProfile.unsavedChanges.stay')}
          </Button>
          <Button type="button" variant="contained" color="warning" onClick={confirmLeaveProfile}>
            {t('portalProfile.unsavedChanges.leave')}
          </Button>
        </DialogActions>
      </Dialog>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />

      <PortalConfirmDialog
        open={removePhotoConfirmOpen}
        onClose={cancelRemovePhotoConfirm}
        onConfirm={confirmRemoveProfilePhoto}
        title={t('portalProfile.removePhotoConfirm.title')}
        body={t('portalProfile.removePhotoConfirm.body')}
        confirmLabel={t('portalProfile.removePhotoConfirm.confirm')}
        cancelLabel={t('portalProfile.removePhotoConfirm.cancel')}
        confirmColor="error"
        loading={photoBusy}
      />

      <ProfilePhotoEditorDialog
        open={photoEditorOpen}
        file={pendingPhotoFile}
        onClose={closePhotoEditor}
        onSave={uploadProfilePhotoBlob}
      />
    </Box>
  );
};

export default PortalProfile;
