import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Modal,
  Paper,
  Popper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Close from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { usePortalTour } from '../PortalTourContext';
import { usePortalShell } from '../PortalShellContext';
import { usePortalAuth } from '../PortalAuthContext';
import { buildPortalTourSteps } from '../portalTour/buildPortalTourSteps';
import { isGuestRole, normalizeRole, resolveRole } from '../portalUtils';
import { allowsDocumentCenter, landlordTierLimits } from '../portalTierUtils';
import { Role } from '../domain/constants.js';

const RING_PAD = 6;
const MODAL_Z = 1700;

function readRect(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return null;
  return el.getBoundingClientRect();
}

const PortalTourOverlay = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const shell = usePortalShell();
  const { account, isAuthenticated, meData, meStatus } = usePortalAuth();
  const {
    isOpen,
    stepIndex,
    setStepIndex,
    persistTourCompletedAndClose,
    persistError,
  } = usePortalTour();

  const role = resolveRole(meData, account);
  const normalizedRole = normalizeRole(role);
  const isGuest = isGuestRole(normalizedRole);
  const roleResolved = isAuthenticated && meStatus !== 'loading';

  const showDocumentsNav =
    normalizedRole !== Role.TENANT || allowsDocumentCenter(landlordTierLimits(meData));

  const steps = useMemo(
    () =>
      buildPortalTourSteps({
        isMobile,
        showNotifications: isAuthenticated,
        showAccount: isAuthenticated,
        showSidebarSignOut: isAuthenticated,
        normalizedRole,
        isGuest,
        roleResolved,
        showDocumentsNav,
      }),
    [isMobile, isAuthenticated, normalizedRole, isGuest, roleResolved, showDocumentsNav]
  );

  const lastIndex = Math.max(0, steps.length - 1);

  useEffect(() => {
    if (stepIndex > lastIndex) setStepIndex(lastIndex);
  }, [stepIndex, lastIndex, setStepIndex]);

  const activeIndex = Math.min(stepIndex, lastIndex);
  const currentStep = steps[activeIndex] ?? null;

  const [ring, setRing] = useState(null);
  const nextRef = useRef(null);

  const remeasure = useCallback(() => {
    if (!isOpen || !currentStep) {
      setRing(null);
      return;
    }
    const raw = readRect(currentStep.targetId);
    if (!raw || (raw.width === 0 && raw.height === 0)) {
      setRing(null);
      return;
    }
    setRing({
      left: raw.left - RING_PAD,
      top: raw.top - RING_PAD,
      width: raw.width + RING_PAD * 2,
      height: raw.height + RING_PAD * 2,
    });
  }, [isOpen, currentStep]);

  useLayoutEffect(() => {
    if (!isOpen || !currentStep) return undefined;

    const navStep = currentStep.targetId.startsWith('portal-tour-nav-');
    const sidebarChromeStep =
      currentStep.targetId === 'portal-tour-sidebar-sign-out'
      || currentStep.targetId === 'portal-tour-sidebar-back-to-site';
    const needsOpenSidebar = navStep || sidebarChromeStep;

    if (shell.isMobile) {
      if (needsOpenSidebar) {
        shell.openMobileSidebar();
      } else {
        shell.closeMobileSidebar();
      }
    } else if (needsOpenSidebar) {
      shell.expandDesktopSidebar?.();
    }

    let cancelled = false;
    const delayMs =
      shell.isMobile && needsOpenSidebar ? 320
        : !shell.isMobile && needsOpenSidebar ? 280
        : 0;

    const run = () => {
      if (cancelled) return;
      remeasure();
    };

    const timer = window.setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, currentStep, pathname, shell, remeasure]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onResize = () => remeasure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [isOpen, remeasure]);

  useEffect(() => {
    if (!isOpen || !currentStep) return;
    const el = document.getElementById(currentStep.targetId);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const id = window.requestAnimationFrame(() => {
      nextRef.current?.focus?.();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, activeIndex]);

  const dimBg = useCallback(
    (muiTheme) => alpha(muiTheme.palette.common.black, muiTheme.palette.mode === 'dark' ? 0.62 : 0.48),
    []
  );

  const virtualAnchor = useMemo(() => {
    if (!ring) return null;
    return {
      getBoundingClientRect: () => ({
        width: ring.width,
        height: ring.height,
        top: ring.top,
        left: ring.left,
        right: ring.left + ring.width,
        bottom: ring.top + ring.height,
        x: ring.left,
        y: ring.top,
        toJSON: () => {},
      }),
    };
  }, [ring]);

  const handleModalClose = useCallback(
    (_, reason) => {
      if (reason === 'escapeKeyDown') {
        void persistTourCompletedAndClose();
      }
    },
    [persistTourCompletedAndClose]
  );

  const goNext = useCallback(() => {
    if (activeIndex >= lastIndex) {
      void persistTourCompletedAndClose();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, lastIndex));
  }, [activeIndex, lastIndex, persistTourCompletedAndClose, setStepIndex]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, [setStepIndex]);

  useEffect(() => {
    if (!isOpen && shell.isMobile) {
      shell.closeMobileSidebar();
    }
  }, [isOpen, shell]);

  if (!isOpen || !currentStep) {
    return null;
  }

  return (
    <Modal
      open={isOpen}
      onClose={handleModalClose}
      disableScrollLock
      hideBackdrop
      slotProps={{
        root: {
          sx: { zIndex: MODAL_Z },
        },
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'auto',
          outline: 'none',
        }}
        role="presentation"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {ring ? (
          <>
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: ring.top,
                zIndex: 0,
                bgcolor: dimBg,
              }}
            />
            <Box
              sx={{
                position: 'fixed',
                top: ring.top + ring.height,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0,
                bgcolor: dimBg,
              }}
            />
            <Box
              sx={{
                position: 'fixed',
                top: ring.top,
                left: 0,
                width: ring.left,
                height: ring.height,
                zIndex: 0,
                bgcolor: dimBg,
              }}
            />
            <Box
              sx={{
                position: 'fixed',
                top: ring.top,
                left: ring.left + ring.width,
                right: 0,
                height: ring.height,
                zIndex: 0,
                bgcolor: dimBg,
              }}
            />
          </>
        ) : (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 0,
              bgcolor: dimBg,
            }}
          />
        )}

        {ring ? (
          <Box
            sx={{
              position: 'fixed',
              left: ring.left,
              top: ring.top,
              width: ring.width,
              height: ring.height,
              zIndex: 1,
              borderRadius: 1,
              boxSizing: 'border-box',
              border: 2,
              borderColor: 'primary.main',
              pointerEvents: 'none',
              bgcolor: 'transparent',
            }}
          />
        ) : null}

        {virtualAnchor ? (
          <Popper
            open
            disablePortal
            anchorEl={virtualAnchor}
            placement={isMobile ? 'bottom' : 'right'}
            modifiers={[
              { name: 'offset', options: { offset: [0, isMobile ? 12 : 16] } },
              { name: 'preventOverflow', options: { padding: 8, altAxis: true } },
            ]}
            sx={{ zIndex: 10, maxWidth: 'calc(100vw - 24px)' }}
          >
            <Paper
              elevation={8}
              role="dialog"
              aria-modal="true"
              aria-labelledby="portal-tour-step-title"
              sx={{
                p: 2,
                maxWidth: { xs: 'min(100vw - 24px, 360px)', sm: 380 },
                backgroundImage: 'none',
                borderRadius: 2,
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                  <Typography id="portal-tour-step-title" variant="subtitle1" component="h2" sx={{ fontWeight: 700, pr: 1 }}>
                    {t(currentStep.titleKey)}
                  </Typography>
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={t('portalTour.close')}
                    onClick={() => void persistTourCompletedAndClose()}
                    sx={{ marginInlineStart: 'auto', flexShrink: 0 }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" aria-live="polite">
                  {t(currentStep.bodyKey)}
                </Typography>
                {persistError ? (
                  <Alert severity="error" variant="outlined">
                    {t('portalTour.persistError')}
                  </Alert>
                ) : null}
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button type="button" size="small" color="inherit" onClick={() => void persistTourCompletedAndClose()}>
                    {t('portalTour.skip')}
                  </Button>
                  <Stack direction="row" spacing={1}>
                    <Button type="button" size="small" onClick={goBack} disabled={activeIndex === 0}>
                      {t('portalTour.back')}
                    </Button>
                    <Button
                      ref={nextRef}
                      type="button"
                      size="small"
                      variant="contained"
                      onClick={goNext}
                    >
                      {activeIndex >= lastIndex ? t('portalTour.done') : t('portalTour.next')}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          </Popper>
        ) : (
          <Paper
            role="dialog"
            aria-modal="true"
            sx={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              p: 2,
              maxWidth: { xs: 'min(100vw - 24px, 360px)', sm: 380 },
              backgroundImage: 'none',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {t(currentStep.titleKey)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(currentStep.bodyKey)}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button type="button" size="small" onClick={() => void persistTourCompletedAndClose()}>
                {t('portalTour.skip')}
              </Button>
              <Button type="button" size="small" variant="contained" onClick={goNext}>
                {activeIndex >= lastIndex ? t('portalTour.done') : t('portalTour.next')}
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>
    </Modal>
  );
};

export default PortalTourOverlay;
