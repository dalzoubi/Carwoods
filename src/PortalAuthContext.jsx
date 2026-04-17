import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { VITE_API_BASE_URL_RESOLVED } from './featureFlags';
import {
  FIREBASE_AUTH_CONFIGURED,
  appleProvider,
  auth,
  facebookProvider,
  googleProvider,
  microsoftProvider,
} from './firebaseAuth';
import { Role } from './domain/constants.js';
import { useMeProfile } from './hooks/useMeProfile';

const PortalAuthContext = createContext(null);

const PORTAL_DEV_AUTH = import.meta.env.VITE_PORTAL_DEV_AUTH === 'true';

const DEV_FREE_TIER_LIMITS = {
  max_properties: 1,
  max_tenants: 5,
  ai_routing_enabled: false,
  csv_export_enabled: false,
  custom_notifications_enabled: false,
  notification_channels: ['in_app'],
  maintenance_request_history_days: 90,
  request_photo_video_attachments_enabled: false,
  property_apply_visibility_editable: false,
  property_elsa_auto_send_editable: false,
  document_center_enabled: false,
};

/** How often (ms) to re-poll /me while a user is authenticated. */
export const ME_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Soft /me refresh coalescing (profile photo error → refreshMe, duplicate avatars, etc.).
 * Use refreshMe({ force: true }) from explicit UI (status page, after profile save).
 */
export const ME_REFRESH_COALESCE_MS = 3000;

const DEV_AUTH_VALUE = PORTAL_DEV_AUTH
  ? {
      baseUrl: '',
      meUrl: '',
      authStatus: 'authenticated',
      authError: '',
      account: { uid: 'dev-user', name: 'Dev Landlord', username: 'dev@carwoods.com' },
      isAuthenticated: true,
      meStatus: 'ok',
      meData: {
        role: Role.LANDLORD,
        user: {
          id: 'dev-user',
          first_name: 'Dev',
          last_name: 'Landlord',
          role: Role.LANDLORD,
          status: 'ACTIVE',
          sms_notifications_allowed: false,
          portal_tour_completed: false,
          tier: {
            id: 'dev-tier-free',
            name: 'FREE',
            display_name: 'Free',
            limits: DEV_FREE_TIER_LIMITS,
          },
        },
      },
      meError: '',
      meErrorStatus: null,
      meErrorCode: null,
      lockoutReason: null,
      signIn: () => Promise.resolve(true),
      signInWithProvider: () => Promise.resolve(true),
      signOut: () => Promise.resolve(),
      refreshMe: () => {},
      getAccessToken: () => Promise.resolve('dev-token'),
      handleApiForbidden: () => {},
    }
  : null;

function toSafeAuthErrorCode(error, fallbackCode) {
  if (error && typeof error === 'object' && typeof error.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  return fallbackCode;
}

function RealPortalAuthProvider({ children }) {
  const [authStatus, setAuthStatus] = useState(
    FIREBASE_AUTH_CONFIGURED ? 'initializing' : 'unconfigured'
  );
  const [authError, setAuthError] = useState('');
  const [account, setAccount] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lockoutReason, setLockoutReason] = useState(null);
  const lastSoftMeRefreshAtRef = useRef(0);

  const baseUrl = VITE_API_BASE_URL_RESOLVED || '';
  const meUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/portal/me` : '';

  const toPortalAccount = useCallback((user) => {
    if (!user) return null;
    const photoURL =
      typeof user.photoURL === 'string' && user.photoURL.trim() ? user.photoURL.trim() : '';
    return {
      uid: user.uid ?? null,
      name: user.displayName ?? '',
      username: user.email ?? '',
      photoURL,
    };
  }, []);

  const applyAccountChooserPrompt = useCallback((provider, providerId) => {
    if (!provider || typeof provider.setCustomParameters !== 'function') return;
    if (providerId === 'google.com' || providerId === 'microsoft.com') {
      provider.setCustomParameters({ prompt: 'select_account' });
    }
  }, []);

  const signInWithProvider = useCallback(async (providerId) => {
    if (!auth) {
      setAuthStatus('unconfigured');
      return false;
    }
    setAuthStatus('authenticating');
    setAuthError('');
    setLockoutReason(null);
    try {
      const providerById = {
        'google.com': googleProvider,
        'apple.com': appleProvider,
        'microsoft.com': microsoftProvider,
        'facebook.com': facebookProvider,
      };
      const provider = providerById[providerId] ?? googleProvider;
      applyAccountChooserPrompt(provider, providerId);
      const result = await signInWithPopup(auth, provider);
      const nextUser = result?.user ?? null;
      setAccount(toPortalAccount(nextUser));
      setAuthStatus(nextUser ? 'authenticated' : 'unauthenticated');
      setRefreshTick((x) => x + 1);
      return true;
    } catch (error) {
      setAuthStatus('error');
      setAuthError(toSafeAuthErrorCode(error, 'auth_failed'));
      return false;
    }
  }, [applyAccountChooserPrompt, toPortalAccount]);

  const signIn = useCallback(() => signInWithProvider('google.com'), [signInWithProvider]);

  const signOut = useCallback(async () => {
    if (!auth) {
      setAuthStatus('unconfigured');
      return;
    }
    try {
      await firebaseSignOut(auth);
    } catch {
      // Best-effort sign out; local state reset below handles the rest.
    }
    setAccount(null);
    setAuthError('');
    setLockoutReason(null);
    setAuthStatus('unauthenticated');
  }, []);

  const signOutDueToDisabledAccount = useCallback(async (reason = 'account_disabled') => {
    if (!auth) {
      setAuthStatus('unconfigured');
      return;
    }
    try {
      await firebaseSignOut(auth);
    } catch {
      // Best-effort; local state reset below handles the rest.
    }
    setAccount(null);
    setAuthError('');
    setAuthStatus('unauthenticated');
    setLockoutReason(reason);
  }, []);

  /**
   * Re-run GET /api/portal/me (via useMeProfile). By default coalesced so duplicate
   * PortalUserAvatar instances or other burst callers cannot hammer the API.
   * @param {{ force?: boolean }} [opts]  Pass `{ force: true }` for explicit user actions.
   */
  const refreshMe = useCallback((opts) => {
    const force = Boolean(opts && typeof opts === 'object' && opts.force === true);
    const now = Date.now();
    if (!force) {
      const prev = lastSoftMeRefreshAtRef.current;
      if (prev !== 0 && now - prev < ME_REFRESH_COALESCE_MS) {
        return;
      }
    }
    lastSoftMeRefreshAtRef.current = now;
    setRefreshTick((x) => x + 1);
  }, []);

  /**
   * Call this whenever a portal API call throws a 403 error.  If the error
   * status is 403 the user's account has been disabled (or access has been
   * revoked) and we immediately sign them out and show the lockout screen,
   * rather than leaving them in a broken state with unexplained error messages.
   *
   * A non-403 error is silently ignored so callers can always call this
   * unconditionally in their catch blocks before re-throwing or setting local
   * error state.
   */
  const handleApiForbidden = useCallback(
    (error) => {
      if (error && typeof error === 'object' && error.status === 403) {
        void signOutDueToDisabledAccount('account_disabled');
      }
    },
    [signOutDueToDisabledAccount]
  );

  // Always read auth.currentUser here — do not close over a User from React state.
  // Otherwise onAuthStateChanged can deliver a new User reference repeatedly
  // (token/profile churn), which recreates this callback, retriggers useMeProfile,
  // and hammers GET /api/portal/me in a tight loop (~one request per round-trip).
  const getAccessToken = useCallback(async () => {
    if (!auth) {
      throw new Error('auth_unavailable');
    }
    const user = auth.currentUser;
    if (!user) {
      throw new Error('auth_unavailable');
    }
    return user.getIdToken();
  }, []);

  useEffect(() => {
    if (!FIREBASE_AUTH_CONFIGURED || !auth) {
      setAuthStatus('unconfigured');
      return;
    }
    setAuthStatus('initializing');
    setAuthError('');
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setAccount((prev) => {
          const nextAcc = toPortalAccount(user);
          if (!prev && !nextAcc) return prev;
          if (
            prev
            && nextAcc
            && prev.uid === nextAcc.uid
            && prev.username === nextAcc.username
            && prev.name === nextAcc.name
            && prev.photoURL === nextAcc.photoURL
          ) {
            return prev;
          }
          return nextAcc;
        });
        setAuthStatus(user ? 'authenticated' : 'unauthenticated');
      },
      (error) => {
        setAccount(null);
        setAuthStatus('error');
        setAuthError(toSafeAuthErrorCode(error, 'auth_init_failed'));
      }
    );
    return () => unsubscribe();
  }, [toPortalAccount]);

  const { meStatus, meData, meError, meErrorStatus, meErrorCode } = useMeProfile({
    account,
    authStatus,
    baseUrl,
    getAccessToken,
    refreshTick,
  });

  // Auto-lockout: sign out immediately when /me returns 403.
  // The error code distinguishes a disabled account from a user with no portal
  // access (not found, wrong role, or guest status).
  useEffect(() => {
    if (meStatus === 'error' && meErrorStatus === 403) {
      const reason =
        meErrorCode === 'account_disabled' ? 'account_disabled' : 'no_portal_access';
      signOutDueToDisabledAccount(reason);
    }
  }, [meStatus, meErrorStatus, meErrorCode, signOutDueToDisabledAccount]);

  // Periodic /me polling while authenticated so a disabled account is detected
  // within ME_POLL_INTERVAL_MS even without navigation or page reload.
  useEffect(() => {
    if (authStatus !== 'authenticated' || !baseUrl) return;
    const id = setInterval(() => {
      if (!auth?.currentUser) return;
      setRefreshTick((x) => x + 1);
    }, ME_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authStatus, baseUrl]);

  const value = useMemo(
    () => ({
      baseUrl,
      meUrl,
      authStatus,
      authError,
      account,
      isAuthenticated: authStatus === 'authenticated',
      meStatus,
      meData,
      meError,
      meErrorStatus,
      meErrorCode,
      lockoutReason,
      signIn,
      signInWithProvider,
      signOut,
      refreshMe,
      getAccessToken,
      handleApiForbidden,
    }),
    [
      account,
      authError,
      authStatus,
      baseUrl,
      lockoutReason,
      meData,
      meError,
      meErrorCode,
      meErrorStatus,
      meStatus,
      meUrl,
      refreshMe,
      getAccessToken,
      handleApiForbidden,
      signIn,
      signInWithProvider,
      signOut,
    ]
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export const PortalAuthProvider = ({ children }) => {
  if (DEV_AUTH_VALUE) {
    return <PortalAuthContext.Provider value={DEV_AUTH_VALUE}>{children}</PortalAuthContext.Provider>;
  }
  return <RealPortalAuthProvider>{children}</RealPortalAuthProvider>;
};

export function usePortalAuth() {
  const value = useContext(PortalAuthContext);
  if (!value) {
    throw new Error('usePortalAuth must be used within PortalAuthProvider');
  }
  return value;
}
