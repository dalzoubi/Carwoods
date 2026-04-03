import type pg from 'pg';

export async function writeAudit(
  client: pg.PoolClient,
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
    `INSERT INTO audit_log (actor_user_id, entity_type, entity_id, action, before_json, after_json)
     VALUES ($1, $2, $3::uuid, $4, $5::jsonb, $6::jsonb)`,
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
