/**
 * Collects non-sensitive runtime diagnostics to attach to a support ticket
 * so bug reports arrive with enough context to triage without follow-ups.
 *
 * Never include authentication tokens, user identifiers, or message
 * contents — only technical environment data the user has already shared
 * with the server by loading the page.
 */
export function collectClientDiagnostics() {
  const safe = (fn) => {
    try { return fn(); } catch { return null; }
  };

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const win = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;

  return {
    url: safe(() => (win ? win.location.href : null)),
    pathname: safe(() => (win ? win.location.pathname : null)),
    referrer: safe(() => (doc ? doc.referrer || null : null)),
    user_agent: safe(() => (nav ? nav.userAgent : null)),
    language: safe(() => (nav ? nav.language : null)),
    platform: safe(() => (nav ? nav.platform : null)),
    viewport: safe(() => {
      if (!win) return null;
      return { width: win.innerWidth, height: win.innerHeight };
    }),
    app_version: safe(() => {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.VITE_APP_VERSION || null;
      }
      return null;
    }),
    collected_at: new Date().toISOString(),
  };
}
