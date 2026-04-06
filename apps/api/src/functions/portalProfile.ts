import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, mapDomainError, requirePortalUser } from '../lib/managementRequest.js';

import { updateProfile } from '../useCases/users/updateProfile.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

async function portalProfileHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const {
    ctx: { user, headers },
  } = gate;

  if (request.method !== 'PATCH') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }

  const payload = asRecord(body);

  try {
    const result = await updateProfile(getPool(), {
      actorUserId: user.id,
      email: str(payload.email),
      firstName: str(payload.first_name) ?? null,
      lastName: str(payload.last_name) ?? null,
      phone: str(payload.phone) ?? null,
    });
    return jsonResponse(200, headers, { user: result.user });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) return mapped;
    throw e;
  }
}

app.http('portalProfile', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/profile',
  handler: portalProfileHandler,
});
