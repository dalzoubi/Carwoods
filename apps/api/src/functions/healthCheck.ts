import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';

async function healthCheckHandler(
  _request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: { status: 'ok', service: '@carwoods/api' },
  };
}

app.http('healthCheck', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthCheckHandler,
});
