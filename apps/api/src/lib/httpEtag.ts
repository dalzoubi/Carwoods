import { createHash } from 'node:crypto';
import type { HttpRequest } from '@azure/functions';
import type { HttpResponseInit } from '@azure/functions';

/**
 * Weak ETag for a JSON body — stable for identical serialized payloads.
 * Used for conditional GET (If-None-Match) to skip response bodies when unchanged.
 */
export function weakEtagForJsonPayload(body: unknown): string {
  const json = JSON.stringify(body);
  const h = createHash('sha256').update(json, 'utf8').digest('base64url');
  return `W/"${h}"`;
}

function normalizeEtagToken(token: string): string {
  return token.trim();
}

/**
 * True if the request's If-None-Match header matches the response ETag
 * (supports comma-separated list and *).
 */
export function requestIfNoneMatchMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch || !etag) return false;
  const e = normalizeEtagToken(etag);
  const trimmed = normalizeEtagToken(ifNoneMatch);
  if (trimmed === '*') return true;
  return trimmed
    .split(',')
    .map((part) => normalizeEtagToken(part))
    .some((token) => token === e);
}

/**
 * JSON 200 with ETag, or 304 when If-None-Match matches (no body).
 */
export function jsonResponseWithEtag(
  request: HttpRequest,
  baseHeaders: Record<string, string>,
  body: unknown
): HttpResponseInit {
  const etag = weakEtagForJsonPayload(body);
  const inm = request.headers.get('if-none-match');
  if (requestIfNoneMatchMatches(inm, etag)) {
    return {
      status: 304,
      headers: { ...baseHeaders, ETag: etag },
    };
  }
  return {
    status: 200,
    headers: { ...baseHeaders, ETag: etag, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: body,
  };
}
