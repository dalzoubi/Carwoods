/**
 * List past tenants for the actor: users whose most recent lease with this landlord is
 * ENDED/TERMINATED AND who have no currently ACTIVE/UPCOMING lease with this landlord.
 *
 * LANDLORD: scoped to own properties. ADMIN may pass landlordId, else all landlords.
 */

import { Role } from '../../domain/constants.js';
import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type PastTenantRow = {
  tenant_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  landlord_user_id: string;
  last_lease_id: string;
  last_property_id: string;
  last_property_street: string;
  last_property_city: string;
  last_property_state: string;
  last_property_zip: string;
  ended_on: string | null;
  ended_reason: string | null;
  final_balance_amount: number | null;
};

export type ListPastTenantsInput = {
  actorUserId: string;
  actorRole: string;
  landlordId?: string | null;
};

export async function listPastTenants(
  db: Queryable,
  input: ListPastTenantsInput
): Promise<{ past_tenants: PastTenantRow[] }> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const role = input.actorRole.trim().toUpperCase();
  const effectiveLandlordId = role === Role.ADMIN ? (input.landlordId ?? null) : input.actorUserId;

  const r = await db.query<PastTenantRow>(
    `WITH scoped AS (
       SELECT l.*, p.created_by AS landlord_user_id,
              p.street AS property_street, p.city AS property_city,
              p.state AS property_state, p.zip AS property_zip
       FROM leases l
       INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
       WHERE l.deleted_at IS NULL
         AND ($1 = 'ADMIN' OR p.created_by = $2)
         AND ($3 IS NULL OR p.created_by = $3)
     ),
     tenant_scope AS (
       SELECT lt.user_id, s.landlord_user_id,
              MAX(CASE WHEN s.status IN ('ACTIVE','UPCOMING') THEN 1 ELSE 0 END) AS has_active
       FROM lease_tenants lt
       INNER JOIN scoped s ON s.id = lt.lease_id
       GROUP BY lt.user_id, s.landlord_user_id
     ),
     ranked AS (
       SELECT lt.user_id, s.landlord_user_id, s.id AS lease_id, s.property_id,
              s.property_street, s.property_city, s.property_state, s.property_zip,
              s.ended_on, s.ended_reason,
              ROW_NUMBER() OVER (
                PARTITION BY lt.user_id, s.landlord_user_id
                ORDER BY s.ended_on DESC, s.updated_at DESC
              ) AS rn
       FROM lease_tenants lt
       INNER JOIN scoped s ON s.id = lt.lease_id
       WHERE s.status IN ('ENDED','TERMINATED')
     )
     SELECT
       CAST(r.user_id AS NVARCHAR(36))         AS tenant_user_id,
       u.email, u.first_name, u.last_name, u.phone,
       CAST(r.landlord_user_id AS NVARCHAR(36)) AS landlord_user_id,
       CAST(r.lease_id AS NVARCHAR(36))        AS last_lease_id,
       CAST(r.property_id AS NVARCHAR(36))     AS last_property_id,
       r.property_street                        AS last_property_street,
       r.property_city                          AS last_property_city,
       r.property_state                         AS last_property_state,
       r.property_zip                           AS last_property_zip,
       CONVERT(NVARCHAR(10), r.ended_on, 23)   AS ended_on,
       r.ended_reason,
       mo.final_balance_amount
     FROM ranked r
     INNER JOIN users u ON u.id = r.user_id AND u.role = '${Role.TENANT}'
     INNER JOIN tenant_scope ts
       ON ts.user_id = r.user_id AND ts.landlord_user_id = r.landlord_user_id
     LEFT JOIN lease_move_outs mo ON mo.lease_id = r.lease_id
     WHERE r.rn = 1
       AND ts.has_active = 0
     ORDER BY r.ended_on DESC, u.last_name, u.first_name`,
    [role, input.actorUserId, effectiveLandlordId]
  );

  return { past_tenants: r.rows };
}
