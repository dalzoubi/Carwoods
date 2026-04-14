/**
 * Export all maintenance requests as CSV (management only).
 *
 * Business rules:
 * - Actor must have landlord or admin access.
 */

import {
  listRequestsForLandlord,
  listRequestsForManagement,
} from '../../lib/requestsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden } from '../../domain/errors.js';
import { Role, hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type ExportRequestsCsvInput = {
  actorUserId: string;
  actorRole: string;
};

export type ExportRequestsCsvOutput = {
  csvContent: string;
  rowCount: number;
};

function csvEscape(v: unknown): string {
  const raw = v === null || v === undefined ? '' : String(v);
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function exportRequestsCsv(
  db: TransactionPool,
  input: ExportRequestsCsvInput
): Promise<ExportRequestsCsvOutput> {
  if (!hasLandlordAccess(input.actorRole)) {
    throw forbidden();
  }

  const role = input.actorRole.trim().toUpperCase();
  const rows =
    role === Role.ADMIN
      ? await listRequestsForManagement(db)
      : await listRequestsForLandlord(db, input.actorUserId);
  const header = [
    'id',
    'property_id',
    'lease_id',
    'submitted_by_user_id',
    'assigned_vendor_id',
    'title',
    'current_status_id',
    'created_at',
    'updated_at',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.property_id,
        row.lease_id,
        row.submitted_by_user_id,
        row.assigned_vendor_id ?? '',
        row.title,
        row.current_status_id,
        row.created_at.toISOString(),
        row.updated_at.toISOString(),
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'REQUEST_EXPORT',
      entityId: '00000000-0000-0000-0000-000000000000',
      action: 'CSV_EXPORT',
      before: null,
      after: { count: rows.length },
    });
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  return { csvContent: lines.join('\n'), rowCount: rows.length };
}
