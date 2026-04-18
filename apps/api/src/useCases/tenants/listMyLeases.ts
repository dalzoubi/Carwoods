/**
 * Tenant-facing: list the authenticated tenant's own leases across all landlords.
 *
 * Also returns, for each lease, any co-sign slot where this tenant needs to sign
 * (so the UI can surface a single "co-sign" prompt without another round-trip).
 */

import { listMyLeases as repoListMyLeases, type TenantLeaseRow } from '../../lib/tenantsRepo.js';
import {
  getLiveNoticeForLease,
  listCoSignsForNotice,
  type LeaseNoticeRow,
} from '../../lib/tenantLifecycleRepo.js';
import { Role } from '../../domain/constants.js';
import { forbidden } from '../../domain/errors.js';
import type { Queryable } from '../types.js';

export type MyLeaseWithNotice = TenantLeaseRow & {
  live_notice: LeaseNoticeRow | null;
  my_co_sign_pending: boolean;
};

export type ListMyLeasesInput = {
  actorUserId: string;
  actorRole: string;
};

export async function listMyLeases(
  db: Queryable,
  input: ListMyLeasesInput
): Promise<{ leases: MyLeaseWithNotice[] }> {
  const role = input.actorRole.trim().toUpperCase();
  if (role !== Role.TENANT) throw forbidden();

  const rows = await repoListMyLeases(db, input.actorUserId);

  const enriched: MyLeaseWithNotice[] = [];
  for (const row of rows) {
    const live = await getLiveNoticeForLease(db, row.id);
    let myCoSignPending = false;
    if (live && live.status === 'pending_co_signers') {
      const coSigns = await listCoSignsForNotice(db, live.id);
      myCoSignPending = coSigns.some(
        (c) => c.tenant_user_id === input.actorUserId && c.signed_at === null
      );
    }
    enriched.push({ ...row, live_notice: live, my_co_sign_pending: myCoSignPending });
  }

  return { leases: enriched };
}
