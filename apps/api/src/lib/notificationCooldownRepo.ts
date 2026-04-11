import type { PoolClient, QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type NotificationChannelKind = 'EMAIL' | 'SMS' | 'IN_APP';

/** Sentinel when no maintenance request applies (onboarding / global). */
export const NOTIFICATION_COOLDOWN_GLOBAL_REQUEST_ID = '00000000-0000-0000-0000-000000000000';

const COOLDOWN_MS = 15 * 60 * 1000;

export function notificationCooldownMs(): number {
  const raw = process.env.NOTIFICATION_CHANNEL_COOLDOWN_MS;
  if (!raw) return COOLDOWN_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : COOLDOWN_MS;
}

export async function getLastChannelFireAt(
  client: Queryable,
  params: { userId: string; requestId: string; channel: NotificationChannelKind }
): Promise<Date | null> {
  const r = await client.query<{ last_fired_at: Date }>(
    `SELECT TOP 1 last_fired_at
     FROM notification_channel_cooldowns
     WHERE user_id = $1 AND request_id = $2 AND channel = $3`,
    [params.userId, params.requestId, params.channel]
  );
  const row = r.rows[0];
  return row?.last_fired_at ?? null;
}

export async function isChannelInCooldown(
  client: Queryable,
  params: { userId: string; requestId: string; channel: NotificationChannelKind; now: Date }
): Promise<boolean> {
  const last = await getLastChannelFireAt(client, params);
  if (!last) return false;
  return params.now.getTime() - new Date(last).getTime() < notificationCooldownMs();
}

export async function touchNotificationChannelCooldown(
  client: PoolClient,
  params: { userId: string; requestId: string; channel: NotificationChannelKind; firedAt: Date }
): Promise<void> {
  await client.query(
    `MERGE notification_channel_cooldowns AS target
     USING (SELECT $1 AS user_id, $2 AS request_id, $3 AS channel) AS src
       ON target.user_id = src.user_id
      AND target.request_id = src.request_id
      AND target.channel = src.channel
     WHEN MATCHED THEN
       UPDATE SET last_fired_at = $4
     WHEN NOT MATCHED THEN
       INSERT (user_id, request_id, channel, last_fired_at)
       VALUES ($1, $2, $3, $4);`,
    [params.userId, params.requestId, params.channel, params.firedAt]
  );
}
