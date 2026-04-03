import type { PoolClient } from './db.js';

export async function writeAudit(
  client: PoolClient,
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
