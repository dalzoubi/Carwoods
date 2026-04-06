import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, requirePortalUser } from '../lib/managementRequest.js';
import { updateUserProfile } from '../lib/usersRepo.js';
import { isValidEmail, isValidPhone } from '../lib/contactValidation.js';

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
  const email = str(payload.email);
  const firstName = str(payload.first_name);
  const lastName = str(payload.last_name);
  const phone = str(payload.phone);

  if (!email) {
    return jsonResponse(400, headers, { error: 'missing_email' });
  }
  if (!isValidEmail(email)) {
    return jsonResponse(400, headers, { error: 'invalid_email' });
  }
  if (firstName && firstName.length > 100) {
    return jsonResponse(400, headers, { error: 'first_name_too_long' });
  }
  if (lastName && lastName.length > 100) {
    return jsonResponse(400, headers, { error: 'last_name_too_long' });
  }
  if (phone && phone.length > 50) {
    return jsonResponse(400, headers, { error: 'phone_too_long' });
  }
  if (phone && !isValidPhone(phone)) {
    return jsonResponse(400, headers, { error: 'invalid_phone' });
  }

  const pool = getPool();
  const updated = await updateUserProfile(pool, user.id, {
    email,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    phone: phone ?? null,
  });
  if (!updated) {
    return jsonResponse(404, headers, { error: 'not_found' });
  }
  return jsonResponse(200, headers, { user: updated });
}

app.http('portalProfile', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/profile',
  handler: portalProfileHandler,
});

