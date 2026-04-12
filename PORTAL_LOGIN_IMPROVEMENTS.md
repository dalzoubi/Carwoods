# Portal Login Improvements - Implementation Prompt

## Context

The Carwoods Management Portal uses Azure MSAL (Entra ID) for authentication via OAuth popup flow. The current implementation works but has UX and security areas that can be improved. This prompt describes the issues and the desired changes.

## Architecture Overview

Key files:
- `src/entraAuth.js` - MSAL instance config (PublicClientApplication)
- `src/PortalAuthContext.jsx` - Central auth state, token management, /me polling
- `src/components/PortalAuthGate.jsx` - Auth wrapper (shows login or children)
- `src/components/PortalLoginLanding.jsx` - Login page UI
- `src/hooks/useMeProfile.js` - Fetches `/api/portal/me` for role/permissions
- `src/lib/portalClaimsStorage.js` - sessionStorage persistence for ID token claims
- `src/components/PortalRouteGuard.jsx` - Role-based route protection

Auth flow: MSAL init → `syncActiveAccount()` → if authenticated, fetch `/api/portal/me` → gate opens to portal content. On sign-in, `loginPopup()` with `prompt: 'select_account'` opens Entra ID in a popup.

---

## Issue 1: Flash of Login Screen on Page Refresh (HIGH PRIORITY)

### Problem
On every page refresh, the user sees the **full login landing page** (logo, feature list, sign-in button area) for ~200-500ms while MSAL initializes, even when they have a valid session. This is the "clunky" behavior reported by users.

**Root cause:** In `PortalAuthGate.jsx` (line 12), when `authStatus === 'initializing'`, `isAuthenticated` is `false`, so `<PortalLoginLanding />` renders. The login landing page does swap the sign-in button for a spinner during init, but the user still sees the full login page layout flash before the portal content loads.

### Solution
Create a **neutral loading screen** (or skeleton) that displays during the `initializing` state, separate from the login page. The gate should distinguish between three states:

1. **Initializing** (MSAL loading, checking for existing session) → Show a minimal loading indicator (e.g., centered spinner with Carwoods logo, no login form or feature list)
2. **Unauthenticated** (no session found) → Show the full `PortalLoginLanding` with sign-in button
3. **Authenticated + /me loading** → Show the same minimal loading indicator (not the login page)

### Implementation Details

**`PortalAuthGate.jsx`** - Add an initializing/loading state check before the unauthenticated check:

```jsx
const PortalAuthGate = ({ children }) => {
  const { authStatus, isAuthenticated, meStatus } = usePortalAuth();

  // While MSAL is initializing or we're re-authenticating silently on refresh,
  // show a neutral loading screen — NOT the login page.
  if (authStatus === 'initializing' || authStatus === 'authenticating') {
    return <PortalLoadingScreen />;
  }

  // After sign-in, wait for /me to complete before showing portal content.
  if (isAuthenticated && meStatus === 'loading') {
    return <PortalLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <PortalLoginLanding />;
  }

  return children;
};
```

**New `PortalLoadingScreen` component** - A minimal, branded loading indicator:
- Centered Carwoods logo
- Simple `CircularProgress` spinner beneath it
- Same background as the portal (`background.default`)
- No login form, no feature list, no sign-in button
- Matches the portal's theme (light/dark mode aware)

---

## Issue 2: Session Lost on Browser Close (MEDIUM PRIORITY)

### Problem
MSAL cache is configured with `cacheLocation: 'sessionStorage'` in `entraAuth.js` (line 35). This means closing the browser tab or window **destroys the session entirely**, forcing a full re-login. For a management portal used daily, this is friction.

### Solution
Change the MSAL cache location from `sessionStorage` to `localStorage`:

**`src/entraAuth.js`** line 35:
```js
cache: {
  cacheLocation: 'localStorage',  // was 'sessionStorage'
  storeAuthStateInCookie: false,
}
```

Also update `src/lib/portalClaimsStorage.js` to use `localStorage` instead of `window.sessionStorage` for the custom claims persistence (the `portal.idTokenClaimsByHomeAccountId` key).

**Security consideration:** localStorage is accessible to any script on the same origin. This is acceptable because:
- MSAL tokens are already origin-scoped
- The portal is a first-party SPA on a controlled domain
- Access tokens are short-lived (typically 1 hour); refresh tokens handle renewal
- This is the recommended configuration for production SPAs per Microsoft docs

---

## Issue 3: Always Prompting Account Selection (LOW-MEDIUM PRIORITY)

### Problem
`signInWithProvider()` in `PortalAuthContext.jsx` (line 88) always passes `prompt: 'select_account'` to `loginPopup()`. This forces users to pick their account every time, even if they only have one account and were recently signed in.

### Solution
Use `prompt: 'select_account'` only for explicit sign-in actions. For silent re-authentication or token renewal, don't force account selection:

- Keep `prompt: 'select_account'` for the initial `signIn()` call (user clicked "Sign In" button)
- Consider adding a `loginHint` parameter using the previously known account email so Entra ID can skip the account picker when possible
- For the `acquireTokenPopup` fallback in `getAccessToken()`, use `prompt: 'none'` first, falling back to interaction only when needed

---

## Issue 4: No Graceful Error Recovery (LOW PRIORITY)

### Problem
When `authStatus === 'error'` (e.g., MSAL init fails due to network), there's no explicit recovery path shown to the user. The login landing page doesn't handle the `error` state — the sign-in button still shows, but the user gets no feedback about what went wrong.

### Solution
In `PortalLoginLanding.jsx`, add an error state display:
- Show `authError` message in an `Alert` component when `authStatus === 'error'`
- Add a "Try Again" / "Retry" button that calls `window.location.reload()` or re-triggers MSAL init
- Consider showing a more user-friendly error message (map technical errors to human-readable text)

---

## Issue 5: Missing CSRF / State Validation Logging (LOW PRIORITY - SECURITY)

### Problem
MSAL handles OAuth state parameter validation internally, but there's no logging or monitoring when auth events fail. The `msalInstance.addEventCallback` in `PortalAuthContext.jsx` (line 230) only listens for `LOGIN_SUCCESS` and `LOGOUT_SUCCESS` — it ignores `LOGIN_FAILURE` events.

### Solution
Add event listeners for failure events to aid debugging and security monitoring:

```js
callbackId = msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.LOGOUT_SUCCESS) {
    syncActiveAccount();
  }
  if (event.eventType === EventType.LOGIN_FAILURE) {
    console.warn('[Portal Auth] Login failed:', event.error?.message);
    // Could send to monitoring/analytics service
  }
});
```

---

## Implementation Order

1. **Issue 1** (Flash of login screen) - Highest impact on UX. Create `PortalLoadingScreen` component and update `PortalAuthGate`.
2. **Issue 2** (sessionStorage → localStorage) - Simple config change, big UX win for returning users.
3. **Issue 3** (Account selection prompt) - Minor tweak to `signInWithProvider`.
4. **Issue 4** (Error recovery) - Add error state to login landing page.
5. **Issue 5** (Auth failure logging) - Add failure event listeners.

## Testing Checklist

- [ ] Page refresh with valid session: should show loading spinner briefly, then portal content (NOT login page)
- [ ] Page refresh with expired/no session: should show loading spinner briefly, then login page
- [ ] Close browser and reopen: should restore session (after Issue 2 fix)
- [ ] Sign out and sign in: should show account picker
- [ ] Account disabled during session: should auto-lockout within 5 minutes
- [ ] MSAL init failure (e.g., offline): should show error with retry option
- [ ] Role-based routes: should still enforce access after all changes
- [ ] Dark mode: loading screen should respect theme
