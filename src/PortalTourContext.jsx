import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePortalAuth } from './PortalAuthContext';
import { emailFromAccount } from './portalUtils';
import { patchUiPreferences } from './lib/portalApiClient';
import PortalTourOverlay from './components/PortalTourOverlay';

const PortalTourContext = createContext(null);

export function PortalTourProvider({ children }) {
  const {
    isAuthenticated,
    meData,
    meStatus,
    baseUrl,
    account,
    getAccessToken,
    refreshMe,
  } = usePortalAuth();

  const accountUid = account?.uid ?? '';
  const autoLaunchAttemptedRef = useRef(false);

  useEffect(() => {
    autoLaunchAttemptedRef.current = false;
  }, [accountUid]);

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [persistError, setPersistError] = useState('');

  const openTour = useCallback(() => {
    setStepIndex(0);
    setPersistError('');
    setIsOpen(true);
  }, []);

  const persistTourCompletedAndClose = useCallback(async () => {
    setPersistError('');
    if (!baseUrl) {
      setIsOpen(false);
      return;
    }
    try {
      const token = await getAccessToken();
      await patchUiPreferences(baseUrl, token, {
        emailHint: emailFromAccount(account),
        portal_tour_completed: true,
      });
      refreshMe({ force: true });
      setIsOpen(false);
    } catch (e) {
      const msg = e && typeof e === 'object' && e.message ? String(e.message) : 'request_failed';
      setPersistError(msg);
    }
  }, [account, baseUrl, getAccessToken, refreshMe]);

  useEffect(() => {
    if (!isAuthenticated || meStatus !== 'ok' || !meData?.user) return;
    if (Boolean(meData.user.portal_tour_completed)) return;
    if (autoLaunchAttemptedRef.current) return;
    autoLaunchAttemptedRef.current = true;
    setStepIndex(0);
    setIsOpen(true);
  }, [isAuthenticated, meData, meStatus]);

  const value = useMemo(
    () => ({
      isOpen,
      stepIndex,
      setStepIndex,
      openTour,
      persistTourCompletedAndClose,
      persistError,
    }),
    [isOpen, stepIndex, openTour, persistTourCompletedAndClose, persistError]
  );

  return (
    <PortalTourContext.Provider value={value}>
      {children}
      <PortalTourOverlay />
    </PortalTourContext.Provider>
  );
}

export function usePortalTour() {
  const ctx = useContext(PortalTourContext);
  if (!ctx) {
    throw new Error('usePortalTour must be used within PortalTourProvider');
  }
  return ctx;
}
