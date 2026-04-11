/**
 * Update the authenticated user's own profile.
 *
 * Business rules:
 * - Email is required and must be valid.
 * - Optional fields: first_name, last_name, phone.
 */

import { findUserByEmail, updateUserProfile, type UserRow } from '../../lib/usersRepo.js';
import { validateProfileUpdate } from '../../domain/userValidation.js';
import { conflictError, notFound, validationError } from '../../domain/errors.js';
import type { Queryable } from '../types.js';

export type UpdateProfileInput = {
  actorUserId: string;
  email: string | undefined;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type UpdateProfileOutput = {
  user: UserRow;
};

export async function updateProfile(
  db: Queryable,
  input: UpdateProfileInput
): Promise<UpdateProfileOutput> {
  const validation = validateProfileUpdate({
    email: input.email,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    phone: input.phone ?? undefined,
  });
  if (!validation.valid) throw validationError(validation.message);

  const existingByEmail = await findUserByEmail(db, input.email!);
  if (existingByEmail && existingByEmail.id !== input.actorUserId) {
    throw conflictError('email_already_in_use');
  }

  let updated: UserRow | null;
  try {
    updated = await updateUserProfile(db, input.actorUserId, {
      email: input.email!,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
    });
  } catch (error) {
    // Handles race conditions when another request claims the email first.
    const message = String((error as { message?: string })?.message ?? '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      throw conflictError('email_already_in_use');
    }
    throw error;
  }

  if (!updated) throw notFound();
  return { user: updated };
}
