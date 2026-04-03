import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';

/**
 * Public read-only listings for the marketing /apply page.
 * TODO: load `apply_visible` rows from PostgreSQL when DATABASE_URL is configured.
 */
async function publicApplyPropertiesHandler(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);

  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  return {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
    },
    jsonBody: { properties: [] as unknown[] },
  };
}

app.http('publicApplyProperties', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'public/apply-properties',
  handler: publicApplyPropertiesHandler,
});
