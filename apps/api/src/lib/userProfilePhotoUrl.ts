import type { UserRow } from './usersRepo.js';
import { buildAttachmentReadUrl } from './requestAttachmentStorage.js';

/** Long-lived read SAS so images stay valid between /me polls; path changes on new upload. */
export const PROFILE_PHOTO_READ_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

export type UserRowWithProfilePhotoUrl = UserRow & { profile_photo_url: string | null };

export function addProfilePhotoReadUrl(user: UserRow): UserRowWithProfilePhotoUrl {
  const path = user.profile_photo_storage_path?.trim();
  const url = path ? buildAttachmentReadUrl(path, PROFILE_PHOTO_READ_URL_TTL_SECONDS) : null;
  return {
    ...user,
    profile_photo_url: url ?? null,
  };
}

/** Read SAS for a stored profile photo path (same TTL as /portal/me). */
export function profilePhotoReadUrlFromStoragePath(
  storagePath: string | null | undefined
): string | null {
  const path = storagePath?.trim();
  if (!path) return null;
  return buildAttachmentReadUrl(path, PROFILE_PHOTO_READ_URL_TTL_SECONDS);
}
