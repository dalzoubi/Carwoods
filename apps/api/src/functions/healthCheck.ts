import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { corsHeadersForRequest } from '../lib/corsHeaders.js';

async function healthCheckHandler(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const headers = corsHeadersForRequest(request);
  if (request.method === 'OPTIONS') {
    return { status: 204, headers };
  }
  return {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: { status: 'ok', service: '@carwoods/api' },
  };
}

app.http('healthCheck', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthCheckHandler,
});
