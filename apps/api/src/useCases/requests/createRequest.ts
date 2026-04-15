/**
 * Create a new maintenance request.
 *
 * Business rules enforced:
 * - Actor must be TENANT, LANDLORD, or ADMIN.
 * - Tenants: active lease_tenants access for the requested lease_id.
 * - Landlords: lease on a property they created, with at least one active tenant on the lease.
 * - Admins: same as landlords without property ownership restriction.
 * - `property_id` must match the lease row.
 * - All lookup codes (category, priority, status) must resolve in the DB.
 * - Field validation via domain/requestValidation.
 */

import {
  findSystemDefaultStatusId,
  getRequestById,
  insertMaintenanceRequest,
  leasePropertyMatches,
  managementCanCreateRequestForLease,
  tenantCanSubmitForLease,
  type RequestRow,
} from '../../lib/requestsRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import {
  validateCreateRequest,
} from '../../domain/requestValidation.js';
import { forbidden, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type CreateRequestInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string | undefined;
  propertyId: string | undefined;
  categoryCode: string | undefined;
  priorityCode: string | undefined;
  title: string | undefined;
  description: string | undefined;
  emergencyAcknowledged: boolean;
};

export type CreateRequestOutput = {
  request: RequestRow;
};

async function resolveLookupId(
  db: { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> },
  tableName: 'service_categories' | 'request_priorities',
  code: string
): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM ${tableName} WHERE UPPER(code) = UPPER($1) AND active = 1`,
    [code]
  );
  return (r.rows[0] as { id: string } | undefined)?.id ?? null;
}

export async function createRequest(
  db: TransactionPool,
  input: CreateRequestInput
): Promise<CreateRequestOutput> {
  const role = input.actorRole.trim().toUpperCase();
  if (role !== Role.TENANT && role !== Role.LANDLORD && role !== Role.ADMIN) {
    throw forbidden('forbidden_create_request');
  }

  const fieldValidation = validateCreateRequest({
    leaseId: input.leaseId,
    propertyId: input.propertyId,
    categoryCode: input.categoryCode,
    priorityCode: input.priorityCode,
    title: input.title,
    description: input.description,
  });
  if (!fieldValidation.valid) {
    throw validationError(fieldValidation.message);
  }

  const leaseMatchesProperty = await leasePropertyMatches(db, input.leaseId!, input.propertyId!);
  if (!leaseMatchesProperty) {
    throw validationError('invalid_lease_property');
  }

  if (role === Role.TENANT) {
    const canSubmit = await tenantCanSubmitForLease(db, input.leaseId!, input.actorUserId);
    if (!canSubmit) {
      throw forbidden('forbidden_lease_access');
    }
  } else {
    const canSubmit = await managementCanCreateRequestForLease(
      db,
      input.leaseId!,
      role,
      input.actorUserId
    );
    if (!canSubmit) {
      throw forbidden('forbidden_lease_access');
    }
  }

  const [categoryId, priorityId, openStatusId] = await Promise.all([
    resolveLookupId(db, 'service_categories', input.categoryCode!),
    resolveLookupId(db, 'request_priorities', input.priorityCode!),
    findSystemDefaultStatusId(db),
  ]);

  if (!categoryId || !priorityId || !openStatusId) {
    throw validationError('invalid_lookup_codes');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await insertMaintenanceRequest(client as Parameters<typeof insertMaintenanceRequest>[0], {
      propertyId: input.propertyId!,
      leaseId: input.leaseId!,
      submittedByUserId: input.actorUserId,
      categoryId,
      priorityId,
      currentStatusId: openStatusId,
      title: input.title!,
      description: input.description!,
      emergencyAcknowledged: input.emergencyAcknowledged,
    });
    const created = (await getRequestById(client as Parameters<typeof getRequestById>[0], inserted.id)) ?? inserted;
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    });
    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'REQUEST_CREATED',
      payload: {
        request_id: created.id,
        property_id: created.property_id,
        lease_id: created.lease_id,
        title: created.title,
      },
      idempotencyKey: `request-created:${created.id}`,
    });
    await client.query('COMMIT');
    return { request: created };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
