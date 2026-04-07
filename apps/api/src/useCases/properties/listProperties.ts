/**
 * List all non-deleted properties (management access required).
 */

import { listPropertiesForActor, type PropertyRowFull } from '../../lib/propertiesRepo.js';
import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListPropertiesInput = {
  actorUserId: string;
  actorRole: string;
  includeDeleted?: boolean;
};

export type ListPropertiesOutput = {
  properties: PropertyRowFull[];
};

export async function listProperties(
  db: Queryable,
  input: ListPropertiesInput
): Promise<ListPropertiesOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const properties = await listPropertiesForActor(
    db,
    input.actorRole,
    input.actorUserId,
    Boolean(input.includeDeleted)
  );
  return { properties };
}
