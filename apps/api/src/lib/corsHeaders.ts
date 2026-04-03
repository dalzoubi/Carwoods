import type { HttpRequest } from '@azure/functions';

const DEFAULT_ORIGINS = [
  'https://carwoods.com',
  'https://www.carwoods.com',
  'http://localhost:3000',
];

/**
 * CORS for browser calls from the Vite site. Set CORS_ALLOWED_ORIGINS on the Function App
 * (comma-separated) to override defaults or add preview domains.
 */
export function corsHeadersForRequest(request: HttpRequest): Record<string, string> {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  const allowed = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;

  const origin = request.headers.get('origin') ?? '';
  const allowOrigin =
    origin && allowed.includes(origin) ? origin : allowed.length === 1 ? allowed[0]! : '';

  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }

  return headers;
}
