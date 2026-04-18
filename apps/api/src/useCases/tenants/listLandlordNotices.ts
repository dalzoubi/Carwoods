/**
 * Landlord-facing: list every live (pending/countered) notice on leases the
 * landlord owns. ADMIN sees every landlord's notices.
 *
 * "Live" excludes withdrawn/rejected/superseded/accepted — i.e. everything that
 * still needs the landlord's (or tenant's) attention.
 */

import {
  listLiveNoticesForLandlord,
  type LandlordNoticeRow,
} from '../../lib/tenantLifecycleRepo.js';
import { Role } from '../../domain/constants.js';
import { forbidden } from '../../domain/errors.js';
import type { Queryable } from '../types.js';

export type ListLandlordNoticesInput = {
  actorUserId: string;
  actorRole: string;
};

export async function listLandlordNotices(
  db: Queryable,
  input: ListLandlordNoticesInput
): Promise<{ notices: LandlordNoticeRow[] }> {
  const role = input.actorRole.trim().toUpperCase();
  if (role !== Role.LANDLORD && role !== Role.ADMIN) throw forbidden();

  const notices = await listLiveNoticesForLandlord(db, role, input.actorUserId);
  return { notices };
}
