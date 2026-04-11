import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getPool } from '../lib/db.js';
import { jsonResponse, mapDomainError, requirePortalUser } from '../lib/managementRequest.js';
import { readJsonBody } from '../lib/readBody.js';
import { logError, logInfo, logWarn } from '../lib/serverLogger.js';
import {
  profilePhotoUploadIntent,
  finalizeProfilePhoto,
  clearProfilePhoto,
} from '../useCases/users/profilePhoto.js';
import { addProfilePhotoReadUrl } from '../lib/userProfilePhotoUrl.js';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

async function portalProfilePhotoUploadIntent(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const {
    ctx: { user, headers },
  } = gate;

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await profilePhotoUploadIntent(getPool(), {
      actorUserId: user.id,
      contentType: str(b.content_type),
      fileSizeBytes: Number(b.file_size_bytes ?? 0),
    });
    logInfo(context, 'portal.profile_photo.upload_intent.ok', { userId: user.id });
    return jsonResponse(200, headers, result);
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) {
      logWarn(context, 'portal.profile_photo.upload_intent.failed', {
        userId: user.id,
        message: e instanceof Error ? e.message : String(e),
      });
      return mapped;
    }
    logError(context, 'portal.profile_photo.upload_intent.error', {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

async function portalProfilePhotoFinalize(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const {
    ctx: { user, headers },
  } = gate;

  if (request.method !== 'POST') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(400, headers, { error: 'invalid_json' });
  }
  const b = asRecord(body);

  try {
    const result = await finalizeProfilePhoto(getPool(), {
      actorUserId: user.id,
      storagePath: str(b.storage_path),
      contentType: str(b.content_type),
      fileSizeBytes: Number(b.file_size_bytes ?? 0),
    });
    logInfo(context, 'portal.profile_photo.finalize.ok', { userId: user.id });
    return jsonResponse(200, headers, {
      user: addProfilePhotoReadUrl(result.user),
    });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) {
      logWarn(context, 'portal.profile_photo.finalize.failed', {
        userId: user.id,
        message: e instanceof Error ? e.message : String(e),
      });
      return mapped;
    }
    logError(context, 'portal.profile_photo.finalize.error', {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

async function portalProfilePhotoDelete(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requirePortalUser(request, context);
  if (!gate.ok) return gate.response;
  const {
    ctx: { user, headers },
  } = gate;

  if (request.method !== 'DELETE') {
    return jsonResponse(405, headers, { error: 'method_not_allowed' });
  }

  try {
    const result = await clearProfilePhoto(getPool(), { actorUserId: user.id });
    logInfo(context, 'portal.profile_photo.delete.ok', { userId: user.id });
    return jsonResponse(200, headers, {
      user: addProfilePhotoReadUrl(result.user),
    });
  } catch (e) {
    const mapped = mapDomainError(e, headers);
    if (mapped) {
      logWarn(context, 'portal.profile_photo.delete.failed', {
        userId: user.id,
        message: e instanceof Error ? e.message : String(e),
      });
      return mapped;
    }
    logError(context, 'portal.profile_photo.delete.error', {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

app.http('portalProfilePhotoUploadIntent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/profile/photo/upload-intent',
  handler: portalProfilePhotoUploadIntent,
});

app.http('portalProfilePhotoFinalize', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/profile/photo/finalize',
  handler: portalProfilePhotoFinalize,
});

app.http('portalProfilePhotoDelete', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal/profile/photo',
  handler: portalProfilePhotoDelete,
});
