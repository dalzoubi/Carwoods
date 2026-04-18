import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { corsHeadersForRequest } from './corsHeaders.js';
import { getBearerToken, verifyAccessToken } from './jwtVerify.js';
import { safeErrorResponseBody } from './safeErrorResponse.js';

type AzureHttpHandler = (
  request: HttpRequest,
  context: InvocationContext
) => Promise<HttpResponseInit> | HttpResponseInit;

type RateLimitBucket = {
  timestampsMs: number[];
  lastSeenMs: number;
};

export type RateLimitOptions = {
  windowMs?: number;
  anonymousLimit?: number;
  authenticatedLimit?: number;
  scope?: string;
  skipMethods?: string[];
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_ANONYMOUS_LIMIT = 30;
const DEFAULT_AUTHENTICATED_LIMIT = 100;

const DEFAULT_SKIP_METHODS = new Set(['OPTIONS']);
const buckets = new Map<string, RateLimitBucket>();
let lastSweepAtMs = 0;

function normalizeIpFromHeader(xForwardedFor: string | null): string {
  if (!xForwardedFor) return 'unknown';
  const [first] = xForwardedFor.split(',');
  return first?.trim() || 'unknown';
}

function pruneBucket(bucket: RateLimitBucket, nowMs: number, windowMs: number): void {
  const threshold = nowMs - windowMs;
  bucket.timestampsMs = bucket.timestampsMs.filter((ts) => ts > threshold);
}

function sweepExpiredBuckets(nowMs: number, windowMs: number): void {
  if (nowMs - lastSweepAtMs < windowMs) return;
  lastSweepAtMs = nowMs;

  for (const [key, bucket] of buckets.entries()) {
    pruneBucket(bucket, nowMs, windowMs);
    if (bucket.timestampsMs.length === 0 && nowMs - bucket.lastSeenMs > windowMs) {
      buckets.delete(key);
    }
  }
}

function buildTooManyRequestsResponse(
  request: HttpRequest,
  retryAfterSeconds: number
): HttpResponseInit {
  return {
    status: 429,
    headers: {
      ...corsHeadersForRequest(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(retryAfterSeconds),
    },
    jsonBody: safeErrorResponseBody(429, { error: 'rate_limit_exceeded' }),
  };
}

async function resolveRateLimitIdentity(request: HttpRequest): Promise<{ keyPart: string }> {
  const token = getBearerToken(request.headers.get('authorization'));
  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      if (claims.sub) {
        return { keyPart: `user:${claims.sub}` };
      }
    } catch {
      // Treat invalid/expired/malformed tokens as anonymous for rate-limit purposes.
    }
  }

  const ip = normalizeIpFromHeader(request.headers.get('x-forwarded-for'));
  return { keyPart: `ip:${ip}` };
}

export function withRateLimit(handler: AzureHttpHandler, options: RateLimitOptions = {}): AzureHttpHandler {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const anonymousLimit = options.anonymousLimit ?? DEFAULT_ANONYMOUS_LIMIT;
  const authenticatedLimit = options.authenticatedLimit ?? DEFAULT_AUTHENTICATED_LIMIT;
  const scope = options.scope ?? 'default';
  const skipMethods = new Set((options.skipMethods ?? Array.from(DEFAULT_SKIP_METHODS)).map((m) => m.toUpperCase()));

  // NOTE: This in-memory limiter is per Function App instance only.
  // For multi-instance production deployments, replace with Azure Cache for Redis.
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (skipMethods.has(request.method.toUpperCase())) {
      return handler(request, context);
    }

    const nowMs = Date.now();
    sweepExpiredBuckets(nowMs, windowMs);

    const identity = await resolveRateLimitIdentity(request);
    const limit = identity.keyPart.startsWith('user:') ? authenticatedLimit : anonymousLimit;
    const key = `${scope}:${identity.keyPart}`;
    const bucket = buckets.get(key) ?? { timestampsMs: [], lastSeenMs: nowMs };
    pruneBucket(bucket, nowMs, windowMs);
    bucket.lastSeenMs = nowMs;

    if (bucket.timestampsMs.length >= limit) {
      const oldestTsMs = bucket.timestampsMs[0] ?? nowMs;
      const retryAfterMs = Math.max(0, oldestTsMs + windowMs - nowMs);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      buckets.set(key, bucket);
      return buildTooManyRequestsResponse(request, retryAfterSeconds);
    }

    bucket.timestampsMs.push(nowMs);
    buckets.set(key, bucket);
    return handler(request, context);
  };
}
