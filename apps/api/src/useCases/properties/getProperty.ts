/**
 * Fetch a single property by ID (management access required).
 */

import { getPropertyById, type PropertyRowFull } from '../../lib/propertiesRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type GetPropertyInput = {
  propertyId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export type GetPropertyOutput = {
  property: PropertyRowFull;
};

export async function getProperty(
  db: Queryable,
  input: GetPropertyInput
): Promise<GetPropertyOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.propertyId) throw validationError('missing_id');

  const property = await getPropertyById(db, input.propertyId);
  if (!property) throw notFound();
  return { property };
}
