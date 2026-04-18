/**
 * Return the notice history for a lease (live notice, co-sign rows, and all prior notices).
 * Accessible to tenants on the lease and to landlords/admin with property access.
 */

import { getLeaseById, listLeaseTenantUserIds } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  listNoticesForLease,
  listCoSignsForNotice,
  getLiveNoticeForLease,
  type LeaseNoticeRow,
  type LeaseNoticeCoSignRow,
} from '../../lib/tenantLifecycleRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess, Role } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type GetLeaseNoticesInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string;
};

export async function getLeaseNotices(
  db: Queryable,
  input: GetLeaseNoticesInput
): Promise<{
  live_notice: LeaseNoticeRow | null;
  live_co_signs: LeaseNoticeCoSignRow[];
  history: LeaseNoticeRow[];
}> {
  const leaseId = String(input.leaseId ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');

  const lease = await getLeaseById(db, leaseId);
  if (!lease) throw notFound('lease_not_found');

  const role = input.actorRole.trim().toUpperCase();
  if (role === Role.TENANT) {
    const tenants = await listLeaseTenantUserIds(db, leaseId);
    if (!tenants.includes(input.actorUserId)) throw forbidden();
  } else if (hasLandlordAccess(role)) {
    const prop = await getPropertyByIdForActor(db, lease.property_id, role, input.actorUserId);
    if (!prop) throw forbidden();
  } else {
    throw forbidden();
  }

  const live = await getLiveNoticeForLease(db, leaseId);
  const liveCoSigns = live ? await listCoSignsForNotice(db, live.id) : [];
  const history = await listNoticesForLease(db, leaseId);

  return {
    live_notice: live,
    live_co_signs: liveCoSigns,
    history,
  };
}
