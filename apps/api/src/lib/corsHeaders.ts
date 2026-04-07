import type { HttpRequest } from '@azure/functions';

const DEFAULT_ORIGINS = [
  'https://carwoods.com',
  'https://www.carwoods.com',
  'http://localhost:3000',
  'https://carwoods-*-dennis-alzoubis-projects.vercel.app/'
];

function normalizeOriginValue(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * True if `origin` equals `pattern`, or `pattern` contains `*` segments matched left-to-right
 * (e.g. `https://carwoods-*.vercel.app` for Vercel preview hosts). Avoid a lone `*` pattern.
 */
function originMatchesPattern(origin: string, pattern: string): boolean {
  if (!pattern.includes('*')) return origin === pattern;

  const segments = pattern.split('*');
  if (segments[0] !== '' && !origin.startsWith(segments[0]!)) return false;

  let pos = segments[0] === '' ? 0 : segments[0]!.length;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;

    if (isLast) {
      if (seg === '') return true;
      const endPos = origin.length - seg.length;
      return endPos >= pos && origin.endsWith(seg);
    }

    if (seg === '') continue;

    const found = origin.indexOf(seg, pos);
    if (found === -1) return false;
    pos = found + seg.length;
  }

  return true;
}

function isOriginAllowed(origin: string, allowed: string[]): boolean {
  const normalizedOrigin = normalizeOriginValue(origin);
  return allowed.some((entry) => originMatchesPattern(normalizedOrigin, normalizeOriginValue(entry)));
}

function resolveAllowOrigin(origin: string, allowed: string[]): string {
  if (origin && isOriginAllowed(origin, allowed)) return origin;
  if (!origin && allowed.length === 1) {
    const only = allowed[0]!;
    if (!only.includes('*')) return only;
  }
  return '';
}

/**
 * CORS for browser calls from the Vite site. Set CORS_ALLOWED_ORIGINS on the Function App
 * (comma-separated) to override defaults or add preview domains. Entries may use one or more `*`
 * wildcards in the origin string (scheme + host + optional port), e.g.
 * `https://carwoods-*.vercel.app` for deployment previews.
 */
export function corsHeadersForRequest(request: HttpRequest): Record<string, string> {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  const custom = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const allowed = Array.from(new Set([...DEFAULT_ORIGINS, ...custom]));

  const origin = request.headers.get('origin') ?? '';
  const allowOrigin = resolveAllowOrigin(origin, allowed);

  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Email-Hint',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }

  return headers;
}
