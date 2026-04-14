/**
 * Update a landlord's profile fields (admin-only).
 *
 * Business rules:
 * - Actor must be ADMIN.
 * - The target user must exist and have the LANDLORD role.
 * - Email, first_name, and last_name are required and validated.
 * - phone is optional.
 */

import {
  findUserById,
  updateUserProfile,
  findUserByEmail,
  type UserRow,
} from '../../lib/usersRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { validateProfileUpdate } from '../../domain/userValidation.js';
import { conflictError, forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type UpdateLandlordProfileInput = {
  actorUserId: string;
  actorRole: string;
  landlordId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

export type UpdateLandlordProfileOutput = {
  landlord: UserRow;
};

export async function updateLandlordProfile(
  db: TransactionPool,
  input: UpdateLandlordProfileInput
): Promise<UpdateLandlordProfileOutput> {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();

  const validation = validateProfileUpdate({
    email: input.email,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    phone: input.phone ?? undefined,
  });
  if (!validation.valid) throw validationError(validation.message);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const landlord = await findUserById(client, input.landlordId);
    if (!landlord) {
      await client.query('ROLLBACK');
      throw notFound('landlord_not_found');
    }
    if (String(landlord.role).toUpperCase() !== Role.LANDLORD) {
      await client.query('ROLLBACK');
      throw forbidden('not_a_landlord');
    }

    // Check email uniqueness if email is changing
    const normalizedEmail = input.email.trim().toLowerCase();
    if (normalizedEmail !== landlord.email?.toLowerCase()) {
      const existing = await findUserByEmail(client, normalizedEmail);
      if (existing && existing.id !== input.landlordId) {
        await client.query('ROLLBACK');
        throw conflictError('email_already_in_use');
      }
    }

    const before = { email: landlord.email, first_name: landlord.first_name, last_name: landlord.last_name, phone: landlord.phone };

    const updated = await updateUserProfile(client, input.landlordId, {
      email: normalizedEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    });

    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound('landlord_not_found');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LANDLORD',
      entityId: input.landlordId,
      action: 'UPDATE',
      before,
      after: { email: updated.email, first_name: updated.first_name, last_name: updated.last_name, phone: updated.phone },
    });

    await client.query('COMMIT');
    return { landlord: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
