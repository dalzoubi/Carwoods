import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { listPublicApplyProperties } from '../lib/propertiesRepo.js';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { getPool, hasDatabaseUrl } from '../lib/db.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';

/**
 * Public read-only listings for the marketing /apply page (`metadata.apply` + `apply_visible`).
 */
async function publicApplyPropertiesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  logInfo(context, 'public.apply_properties.start', { method: request.method });
  const headers = corsHeadersForRequest(request);

  if (request.method === 'OPTIONS') {
    logInfo(context, 'public.apply_properties.options');
    return { status: 204, headers };
  }

  if (!hasDatabaseUrl()) {
    logWarn(context, 'public.apply_properties.database_unconfigured');
    return {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
      },
      jsonBody: { properties: [] },
    };
  }

  try {
    const pool = getPool();
    const properties = await listPublicApplyProperties(pool);
    logInfo(context, 'public.apply_properties.success', { count: properties.length });
    return {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
      },
      jsonBody: { properties },
    };
  } catch (error) {
    logError(context, 'public.apply_properties.error', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
      },
      jsonBody: { properties: [] },
    };
  }
}

app.http('publicApplyProperties', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'public/apply-properties',
  handler: publicApplyPropertiesHandler,
});
