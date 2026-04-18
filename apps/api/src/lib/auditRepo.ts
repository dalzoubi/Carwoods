import type { QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type AuditLogRow = {
  id: string;
  actor_user_id: string;
  actor_display_name: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before_json: string | null;
  after_json: string | null;
  created_at: Date;
};

export async function writeAudit(
  client: Queryable,
  params: {
    actorUserId: string;
    entityType: string;
    entityId: string;
    action: string;
    before: unknown;
    after: unknown;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6)`,
    [
      params.actorUserId,
      params.entityType,
      params.entityId,
      params.action,
      JSON.stringify(params.before ?? null),
      JSON.stringify(params.after ?? null),
    ]
  );
}

export async function listAuditForEntity(
  client: Queryable,
  entityId: string,
  limit = 100
): Promise<AuditLogRow[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 500)) : 100;
  const r = await client.query<AuditLogRow>(
    `SELECT TOP (${safeLimit})
        al.id,
        al.actor_user_id,
        CASE
          WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
          ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
        END AS actor_display_name,
        al.entity_type,
        al.entity_id,
        al.action,
        al.before_json,
        al.after_json,
        al.created_at
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.actor_user_id
     WHERE entity_id = $1
     ORDER BY al.created_at DESC`,
    [entityId]
  );
  return r.rows;
}
