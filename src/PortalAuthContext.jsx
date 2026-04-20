import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { VITE_API_BASE_URL_RESOLVED, isPortalApiReachable } from './featureFlags';
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
import { useIdleTimeout } from './hooks/useIdleTimeout';
import SessionExpiringModal from './components/SessionExpiringModal';
import {
  ABSOLUTE_CHECK_INTERVAL_MS,
  ABSOLUTE_SESSION_DEFAULT_MS,
  ABSOLUTE_SESSION_PERSIST_MS,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  PERSIST_CHOICE_KEY,
  SESSION_BROADCAST_CHANNEL,
  SIGNED_IN_AT_KEY,
} from './sessionConfig';

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
 * Soft refreshes use the silent tick (no loading UI). Use `refreshMe({ force: true })` after
 * explicit UI actions (status page, profile save).
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
          // Matches Playwright /api/portal/me mock — false auto-opens PortalTourOverlay on every load.
          portal_tour_completed: true,
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
      persistChoice: false,
      sessionWarningOpen: false,
      sessionWarningDeadlineAt: null,
      extendSession: () => {},
      signIn: () => Promise.resolve(true),
      signInWithProvider: () => Promise.resolve(true),
      signOut: () => Promise.resolve(),
      refreshMe: () => {},
      getAccessToken: () => Promise.resolve('dev-token'),
      handleApiForbidden: () => {},
    }
  : null;

function readPersistChoice() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(PERSIST_CHOICE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readSignedInAt() {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.localStorage?.getItem(SIGNED_IN_AT_KEY)
      ?? window.sessionStorage?.getItem(SIGNED_IN_AT_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSignedInAt(persist, now) {
  if (typeof window === 'undefined') return;
  try {
    const value = String(now);
    if (persist) {
      window.localStorage?.setItem(SIGNED_IN_AT_KEY, value);
      window.sessionStorage?.removeItem(SIGNED_IN_AT_KEY);
    } else {
      window.sessionStorage?.setItem(SIGNED_IN_AT_KEY, value);
      window.localStorage?.removeItem(SIGNED_IN_AT_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode, quota). Absolute cap becomes best-effort.
  }
}

function clearSignedInAt() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(SIGNED_IN_AT_KEY);
    window.sessionStorage?.removeItem(SIGNED_IN_AT_KEY);
  } catch {
    // Ignore storage errors on sign-out.
  }
}

function writePersistChoice(persist) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(PERSIST_CHOICE_KEY, persist ? 'true' : 'false');
  } catch {
    // Ignore storage errors.
  }
}

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
  const [silentRefreshTick, setSilentRefreshTick] = useState(0);
  const [lockoutReason, setLockoutReason] = useState(null);
  const [persistChoice, setPersistChoiceState] = useState(() => readPersistChoice());
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [sessionWarningDeadlineAt, setSessionWarningDeadlineAt] = useState(null);
  const lastSoftMeRefreshAtRef = useRef(0);
  const broadcastRef = useRef(null);

  const baseUrl = VITE_API_BASE_URL_RESOLVED || '';
  const meUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/api/portal/me`
    : isPortalApiReachable('')
      ? '/api/portal/me'
      : '';

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

  const signInWithProvider = useCallback(
    async (providerId, options) => {
      if (!auth) {
        setAuthStatus('unconfigured');
        return false;
      }
      const keepSignedIn = Boolean(
        options && typeof options === 'object' && options.keepSignedIn === true
      );
      setAuthStatus('authenticating');
      setAuthError('');
      setLockoutReason(null);
      try {
        await setPersistence(
          auth,
          keepSignedIn ? browserLocalPersistence : browserSessionPersistence
        );
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
        if (nextUser) {
          writePersistChoice(keepSignedIn);
          writeSignedInAt(keepSignedIn, Date.now());
          setPersistChoiceState(keepSignedIn);
        }
        setAccount(toPortalAccount(nextUser));
        setAuthStatus(nextUser ? 'authenticated' : 'unauthenticated');
        setRefreshTick((x) => x + 1);
        return true;
      } catch (error) {
        setAuthStatus('error');
        setAuthError(toSafeAuthErrorCode(error, 'auth_failed'));
        return false;
      }
    },
    [applyAccountChooserPrompt, toPortalAccount]
  );

  const signIn = useCallback(
    (options) => signInWithProvider('google.com', options),
    [signInWithProvider]
  );

  const broadcastSignout = useCallback(() => {
    const channel = broadcastRef.current;
    if (channel) {
      try {
        channel.postMessage({ type: 'signout' });
      } catch {
        // Ignore BroadcastChannel errors.
      }
    }
  }, []);

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
    clearSignedInAt();
    setAccount(null);
    setAuthError('');
    setLockoutReason(null);
    setAuthStatus('unauthenticated');
    setSessionWarningOpen(false);
    broadcastSignout();
  }, [broadcastSignout]);

  const signOutDueToDisabledAccount = useCallback(
    async (reason = 'account_disabled') => {
      if (!auth) {
        setAuthStatus('unconfigured');
        return;
      }
      try {
        await firebaseSignOut(auth);
      } catch {
        // Best-effort; local state reset below handles the rest.
      }
      clearSignedInAt();
      setAccount(null);
      setAuthError('');
      setAuthStatus('unauthenticated');
      setLockoutReason(reason);
      setSessionWarningOpen(false);
      broadcastSignout();
    },
    [broadcastSignout]
  );

  const signOutDueToIdleTimeout = useCallback(() => {
    void signOutDueToDisabledAccount('idle_timeout');
  }, [signOutDueToDisabledAccount]);

  const signOutDueToAbsoluteTimeout = useCallback(() => {
    void signOutDueToDisabledAccount('absolute_timeout');
  }, [signOutDueToDisabledAccount]);

  /**
   * Re-run GET /api/portal/me (via useMeProfile). By default coalesced so duplicate
   * PortalUserAvatar instances or other burst callers cannot hammer the API.
   * @param {{ force?: boolean }} [opts]  `force: true` — loud refresh (loading UI). Otherwise silent.
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
    if (force) {
      setRefreshTick((x) => x + 1);
    } else {
      setSilentRefreshTick((x) => x + 1);
    }
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
    // Migrate existing Firebase sessions to the persistence tier the user
    // actually chose. This is what makes the "close tab = signed out" rule
    // apply to users who signed in BEFORE this feature shipped (their
    // Firebase session lives in localStorage until we move it).
    const desired = readPersistChoice() ? browserLocalPersistence : browserSessionPersistence;
    setPersistence(auth, desired).catch(() => {
      // Best-effort migration; Firebase falls back to its current persistence.
    });
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
        // Backfill signedInAt for users whose session predates this feature
        // so the absolute-session cap starts ticking from first sight instead
        // of letting them stay indefinitely.
        if (user && readSignedInAt() == null) {
          writeSignedInAt(readPersistChoice(), Date.now());
        }
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
    silentRefreshTick,
  });

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setSilentRefreshTick(0);
    }
  }, [authStatus]);

  useEffect(() => {
    setSilentRefreshTick(0);
  }, [account?.uid]);

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
    if (authStatus !== 'authenticated' || !isPortalApiReachable(baseUrl)) return;
    const id = setInterval(() => {
      if (!auth?.currentUser) return;
      setSilentRefreshTick((x) => x + 1);
    }, ME_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authStatus, baseUrl]);

  // Cross-tab signout: one tab signing out (idle/absolute/manual) forces the
  // others back to the login screen within a tick.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
      return undefined;
    }
    const channel = new window.BroadcastChannel(SESSION_BROADCAST_CHANNEL);
    broadcastRef.current = channel;
    channel.onmessage = (event) => {
      const data = event?.data;
      if (data && data.type === 'signout') {
        clearSignedInAt();
        setAccount(null);
        setAuthError('');
        setAuthStatus('unauthenticated');
        setSessionWarningOpen(false);
      }
    };
    return () => {
      broadcastRef.current = null;
      try {
        channel.close();
      } catch {
        // Ignore close errors.
      }
    };
  }, []);

  // Idle-timeout: sign out after IDLE_TIMEOUT_MS of no user activity.
  // Applies regardless of the "Keep me signed in" choice — the persistence
  // flag governs browser-close behavior, not how long an unattended session
  // can stay open.
  const isAuthenticated = authStatus === 'authenticated';

  const handleIdleWarn = useCallback(() => {
    setSessionWarningDeadlineAt(Date.now() + IDLE_WARNING_MS);
    setSessionWarningOpen(true);
  }, []);

  const extendSession = useCallback(() => {
    setSessionWarningOpen(false);
    setSessionWarningDeadlineAt(null);
  }, []);

  useIdleTimeout({
    enabled: isAuthenticated,
    idleMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onWarn: handleIdleWarn,
    onTimeout: signOutDueToIdleTimeout,
  });

  // Absolute-session cap: even active users are forced to re-auth after
  // ABSOLUTE_SESSION_DEFAULT_MS (or ABSOLUTE_SESSION_PERSIST_MS when "Keep me
  // signed in" was ticked) since the signedInAt timestamp.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const cap = persistChoice ? ABSOLUTE_SESSION_PERSIST_MS : ABSOLUTE_SESSION_DEFAULT_MS;
    const check = () => {
      const signedInAt = readSignedInAt();
      if (signedInAt == null) return;
      if (Date.now() - signedInAt >= cap) {
        signOutDueToAbsoluteTimeout();
      }
    };
    check();
    const id = setInterval(check, ABSOLUTE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, persistChoice, signOutDueToAbsoluteTimeout]);

  const setPersistChoice = useCallback((next) => {
    const value = Boolean(next);
    setPersistChoiceState(value);
    writePersistChoice(value);
  }, []);

  const value = useMemo(
    () => ({
      baseUrl,
      meUrl,
      authStatus,
      authError,
      account,
      isAuthenticated,
      meStatus,
      meData,
      meError,
      meErrorStatus,
      meErrorCode,
      lockoutReason,
      persistChoice,
      sessionWarningOpen,
      sessionWarningDeadlineAt,
      extendSession,
      setPersistChoice,
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
      extendSession,
      isAuthenticated,
      lockoutReason,
      meData,
      meError,
      meErrorCode,
      meErrorStatus,
      meStatus,
      meUrl,
      persistChoice,
      refreshMe,
      sessionWarningDeadlineAt,
      sessionWarningOpen,
      setPersistChoice,
      getAccessToken,
      handleApiForbidden,
      signIn,
      signInWithProvider,
      signOut,
    ]
  );

  return (
    <PortalAuthContext.Provider value={value}>
      {children}
      <SessionExpiringModal
        open={sessionWarningOpen && isAuthenticated}
        deadlineAt={sessionWarningDeadlineAt}
        onStay={extendSession}
        onSignOut={signOut}
      />
    </PortalAuthContext.Provider>
  );
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
