/**
 * Profile photo upload intent and finalize (Azure Blob, same container as attachments).
 */

import { randomUUID } from 'node:crypto';
import {
  findUserById,
  updateUserProfilePhotoPath,
  type UserRow,
} from '../../lib/usersRepo.js';
import {
  buildAttachmentUploadUrl,
  deleteAttachmentBlobIfExists,
} from '../../lib/requestAttachmentStorage.js';
import { getGlobalAttachmentUploadConfigCached } from '../../lib/attachmentUploadConfigRepo.js';
import { notFound, unprocessable, validationError } from '../../domain/errors.js';
import type { Queryable } from '../types.js';

export const PROFILE_PHOTO_UPLOAD_SAS_SECONDS = 600;

async function maxProfilePhotoPickBytes(db: Queryable): Promise<number> {
  const globalConfig = await getGlobalAttachmentUploadConfigCached(db);
  if (!globalConfig) throw unprocessable('attachment_config_missing');
  return globalConfig.max_image_bytes;
}

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeGuidSegment(id: string): string {
  return id.replace(/[{}]/g, '').trim().toLowerCase();
}

export function extensionForProfilePhotoContentType(contentType: string): string | null {
  const c = contentType.trim().toLowerCase();
  if (c === 'image/jpeg') return 'jpg';
  if (c === 'image/png') return 'png';
  if (c === 'image/webp') return 'webp';
  return null;
}

export function isProfilePhotoPathForUser(storagePath: string, userId: string): boolean {
  const p = storagePath.trim().replace(/\\/g, '/');
  if (!p || p.includes('..')) return false;
  const segments = p.split('/').filter(Boolean);
  if (segments.length !== 3) return false;
  if (segments[0] !== 'profile-photos') return false;
  if (normalizeGuidSegment(segments[1]!) !== normalizeGuidSegment(userId)) return false;
  const file = segments[2]!;
  if (!file || file.includes('..') || file.includes('/')) return false;
  return true;
}

export type ProfilePhotoUploadIntentInput = {
  actorUserId: string;
  contentType: string | undefined;
  fileSizeBytes: number;
};

export type ProfilePhotoUploadIntentOutput = {
  upload_url: string;
  storage_path: string;
  expires_in_seconds: number;
};

export async function profilePhotoUploadIntent(
  db: Queryable,
  input: ProfilePhotoUploadIntentInput
): Promise<ProfilePhotoUploadIntentOutput> {
  const ct = input.contentType?.trim() ?? '';
  if (!ct || !ALLOWED_CONTENT_TYPES.has(ct.toLowerCase())) {
    throw validationError('invalid_profile_photo_content_type');
  }
  const ext = extensionForProfilePhotoContentType(ct);
  if (!ext) throw validationError('invalid_profile_photo_content_type');

  if (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
    throw validationError('invalid_profile_photo_size');
  }
  const pickMaxBytes = await maxProfilePhotoPickBytes(db);
  if (input.fileSizeBytes > pickMaxBytes) {
    throw Object.assign(validationError('profile_photo_too_large'), {
      max_bytes: pickMaxBytes,
    });
  }

  const user = await findUserById(db, input.actorUserId);
  if (!user) throw notFound();

  const blobName = `${randomUUID()}.${ext}`;
  const storagePath = `profile-photos/${normalizeGuidSegment(user.id)}/${blobName}`;
  const uploadUrl = buildAttachmentUploadUrl(storagePath, ct, PROFILE_PHOTO_UPLOAD_SAS_SECONDS);
  if (!uploadUrl) {
    throw unprocessable('storage_not_configured');
  }

  return {
    upload_url: uploadUrl,
    storage_path: storagePath,
    expires_in_seconds: PROFILE_PHOTO_UPLOAD_SAS_SECONDS,
  };
}

export type FinalizeProfilePhotoInput = {
  actorUserId: string;
  storagePath: string | undefined;
  contentType: string | undefined;
  fileSizeBytes: number;
};

export type FinalizeProfilePhotoOutput = { user: UserRow };

export async function finalizeProfilePhoto(
  db: Queryable,
  input: FinalizeProfilePhotoInput
): Promise<FinalizeProfilePhotoOutput> {
  const path = input.storagePath?.trim() ?? '';
  const ct = input.contentType?.trim() ?? '';
  if (!path) throw validationError('missing_storage_path');
  if (!ct || !ALLOWED_CONTENT_TYPES.has(ct.toLowerCase())) {
    throw validationError('invalid_profile_photo_content_type');
  }
  if (!isProfilePhotoPathForUser(path, input.actorUserId)) {
    throw validationError('invalid_profile_photo_path');
  }
  if (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
    throw validationError('invalid_profile_photo_size');
  }
  const pickMaxBytes = await maxProfilePhotoPickBytes(db);
  if (input.fileSizeBytes > pickMaxBytes) {
    throw Object.assign(validationError('profile_photo_too_large'), {
      max_bytes: pickMaxBytes,
    });
  }

  const before = await findUserById(db, input.actorUserId);
  if (!before) throw notFound();

  const oldPath = before.profile_photo_storage_path?.trim() || null;
  const updated = await updateUserProfilePhotoPath(db, input.actorUserId, path);
  if (!updated) throw notFound();

  if (oldPath && oldPath !== path) {
    await deleteAttachmentBlobIfExists(oldPath);
  }

  return { user: updated };
}

export type ClearProfilePhotoInput = { actorUserId: string };

export type ClearProfilePhotoOutput = { user: UserRow };

export async function clearProfilePhoto(
  db: Queryable,
  input: ClearProfilePhotoInput
): Promise<ClearProfilePhotoOutput> {
  const before = await findUserById(db, input.actorUserId);
  if (!before) throw notFound();

  const oldPath = before.profile_photo_storage_path?.trim() || null;
  const updated = await updateUserProfilePhotoPath(db, input.actorUserId, null);
  if (!updated) throw notFound();

  if (oldPath) {
    await deleteAttachmentBlobIfExists(oldPath);
  }

  return { user: updated };
}
