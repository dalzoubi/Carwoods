import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { listPublicApplyProperties } from '../lib/propertiesRepo.js';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';
import { getPool, hasDatabaseUrl } from '../lib/db.js';

/**
 * Public read-only listings for the marketing /apply page (`metadata.apply` + `apply_visible`).
 */
async function publicApplyPropertiesHandler(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  if (!hasDatabaseUrl()) {
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
    return {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
      },
      jsonBody: { properties },
    };
  } catch {
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
