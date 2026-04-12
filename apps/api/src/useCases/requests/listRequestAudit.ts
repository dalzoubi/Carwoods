import { getRequestById, landlordOwnsRequestProperty } from '../../lib/requestsRepo.js';
import { listAuditForEntity, type AuditLogRow } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListRequestAuditInput = {
  requestId: string | undefined;
  actorRole: string;
  actorUserId: string;
};

export type ListRequestAuditOutput = {
  audits: AuditLogRow[];
};

export async function listRequestAudit(
  db: Queryable,
  input: ListRequestAuditInput
): Promise<ListRequestAuditOutput> {
  if (!input.requestId) throw validationError('missing_id');
  const role = input.actorRole.trim().toUpperCase();
  if (role !== Role.ADMIN && role !== Role.LANDLORD) throw forbidden();

  const request = await getRequestById(db, input.requestId);
  if (!request) throw notFound();

  if (role === Role.LANDLORD) {
    const allowed = await landlordOwnsRequestProperty(db, input.requestId, input.actorUserId);
    if (!allowed) throw forbidden();
  }

  const audits = await listAuditForEntity(db, input.requestId, 200);
  return { audits };
}

