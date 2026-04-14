import {
  findRequestLandlordUserId,
  getGlobalAttachmentUploadConfigCached,
  getLandlordAttachmentUploadOverrideCached,
} from '../../lib/attachmentUploadConfigRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { getRequestAttachmentById, managementCanAccessRequest } from '../../lib/requestsRepo.js';
import { signAttachmentAccessToken } from '../../lib/secureSignedToken.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { validateRequestId } from '../../domain/requestValidation.js';
import { isValidUuid } from '../../domain/validation.js';
import {
  ATTACHMENT_CONFIG_RANGES,
} from '../../domain/attachmentUploadConfig.js';
import type { TransactionPool } from '../types.js';

export type CreateRequestAttachmentShareLinkInput = {
  requestId: string | undefined;
  attachmentId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type CreateRequestAttachmentShareLinkOutput = {
  /** Path-only deep link; prepend SPA origin for emails. */
  portal_path: string;
  access_token: string;
  expires_at: string;
  expires_in_seconds: number;
};

export async function createRequestAttachmentShareLink(
  db: TransactionPool,
  input: CreateRequestAttachmentShareLinkInput
): Promise<CreateRequestAttachmentShareLinkOutput> {
  const idValidation = validateRequestId(input.requestId);
  if (!idValidation.valid) {
    if (idValidation.message === 'missing_id') throw validationError('missing_id');
    throw notFound();
  }
  if (!input.attachmentId || !isValidUuid(input.attachmentId)) {
    throw validationError('invalid_attachment_id');
  }

  const role = input.actorRole.trim().toUpperCase();
  if (!hasLandlordAccess(role) || role === Role.TENANT) {
    throw forbidden('only_management_can_share_attachments');
  }

  const requestId = input.requestId!;
  const allowed = await managementCanAccessRequest(db, requestId, role, input.actorUserId);
  if (!allowed) throw notFound();

  const attachment = await getRequestAttachmentById(db, requestId, input.attachmentId);
  if (!attachment) throw notFound();

  const globalConfig = await getGlobalAttachmentUploadConfigCached(db);
  if (!globalConfig) throw validationError('attachment_config_missing');
  const landlordUserId = await findRequestLandlordUserId(db, requestId);
  const landlordOverride = landlordUserId
    ? await getLandlordAttachmentUploadOverrideCached(db, landlordUserId)
    : null;
  const effectiveConfig = landlordOverride ?? globalConfig;
  if (!effectiveConfig.share_enabled) {
    throw validationError('attachment_share_disabled');
  }

  const rawExpiry = Math.min(
    Math.max(ATTACHMENT_CONFIG_RANGES.shareExpirySeconds.min, effectiveConfig.share_expiry_seconds),
    ATTACHMENT_CONFIG_RANGES.shareExpirySeconds.max
  );
  /** Phase 4: notification-style links capped at 24h (spec). */
  const PHASE4_MAX_SEC = 86400;
  const expiresInSeconds = Math.min(PHASE4_MAX_SEC, rawExpiry);
  const expiresAtEpochSec = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const accessToken = signAttachmentAccessToken({
    requestId,
    attachmentId: attachment.id,
    expiresAtEpochSec,
  });
  const expiresAt = new Date(expiresAtEpochSec * 1000).toISOString();
  const q = new URLSearchParams({
    id: requestId,
    attachment: attachment.id,
    atoken: accessToken,
  });
  const portalPath = `/portal/requests?${q.toString()}`;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'REQUEST_ATTACHMENT',
      entityId: attachment.id,
      action: 'SHARE_LINK_CREATED',
      before: null,
      after: {
        request_id: requestId,
        attachment_id: attachment.id,
        expires_at: expiresAt,
        expires_in_seconds: expiresInSeconds,
        secure_portal_link: true,
      },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    portal_path: portalPath,
    access_token: accessToken,
    expires_at: expiresAt,
    expires_in_seconds: expiresInSeconds,
  };
}
