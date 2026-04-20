import type { QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type NotificationMetricsWindow = {
  window: string;
  deliveries_created: number;
  portal_notifications_created: number;
  outbox_dispatched: number;
};

type WindowKey = '1m' | '24h' | '7d' | '30d';

const WINDOW_SQL: Record<WindowKey, string> = {
  '1m': 'DATEADD(MINUTE, -1, SYSDATETIMEOFFSET())',
  '24h': 'DATEADD(HOUR, -24, SYSDATETIMEOFFSET())',
  '7d': 'DATEADD(DAY, -7, SYSDATETIMEOFFSET())',
  '30d': 'DATEADD(DAY, -30, SYSDATETIMEOFFSET())',
};

async function countDeliveriesGlobal(db: Queryable, sinceSql: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM notification_deliveries WHERE created_at >= ${sinceSql}`
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function countDeliveriesLandlord(
  db: Queryable,
  sinceSql: string,
  landlordUserId: string
): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM notification_deliveries nd
     INNER JOIN notification_outbox no ON no.id = nd.outbox_id
     OUTER APPLY (
       SELECT TRY_CAST(JSON_VALUE(no.payload, '$.request_id') AS UNIQUEIDENTIFIER) AS rid
     ) AS j
     INNER JOIN maintenance_requests mr ON mr.id = j.rid
     INNER JOIN properties p ON p.id = mr.property_id
     WHERE nd.created_at >= ${sinceSql}
       AND j.rid IS NOT NULL
       AND mr.deleted_at IS NULL
       AND p.created_by = $1`,
    [landlordUserId]
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function countPortalNotifGlobal(db: Queryable, sinceSql: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM portal_notification_events WHERE occurred_at >= ${sinceSql}`
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function countPortalNotifLandlord(
  db: Queryable,
  sinceSql: string,
  landlordUserId: string
): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM portal_notification_events pne
     INNER JOIN maintenance_requests mr ON mr.id = pne.request_id AND mr.deleted_at IS NULL
     INNER JOIN properties p ON p.id = mr.property_id
     WHERE pne.occurred_at >= ${sinceSql}
       AND p.created_by = $1`,
    [landlordUserId]
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function countOutboxDispatchedGlobal(db: Queryable, sinceSql: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM notification_outbox
     WHERE processed_at >= ${sinceSql}
       AND status = 'SENT'`
  );
  return Number(r.rows[0]?.c ?? 0);
}

async function countOutboxDispatchedLandlord(
  db: Queryable,
  sinceSql: string,
  landlordUserId: string
): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM notification_outbox no
     OUTER APPLY (
       SELECT TRY_CAST(JSON_VALUE(no.payload, '$.request_id') AS UNIQUEIDENTIFIER) AS rid
     ) AS j
     INNER JOIN maintenance_requests mr ON mr.id = j.rid AND mr.deleted_at IS NULL
     INNER JOIN properties p ON p.id = mr.property_id
     WHERE no.processed_at >= ${sinceSql}
       AND no.status = 'SENT'
       AND j.rid IS NOT NULL
       AND p.created_by = $1`,
    [landlordUserId]
  );
  return Number(r.rows[0]?.c ?? 0);
}

export async function aggregateNotificationMetricsForWindows(
  db: Queryable,
  params: { landlordUserId: string | null }
): Promise<{ generated_at: string; windows: NotificationMetricsWindow[] }> {
  const keys: WindowKey[] = ['1m', '24h', '7d', '30d'];
  const windows: NotificationMetricsWindow[] = [];
  const landlordId = params.landlordUserId;

  for (const key of keys) {
    const sinceSql = WINDOW_SQL[key];
    let deliveries: number;
    let portalN: number;
    let outbox: number;
    if (landlordId) {
      [deliveries, portalN, outbox] = await Promise.all([
        countDeliveriesLandlord(db, sinceSql, landlordId),
        countPortalNotifLandlord(db, sinceSql, landlordId),
        countOutboxDispatchedLandlord(db, sinceSql, landlordId),
      ]);
    } else {
      [deliveries, portalN, outbox] = await Promise.all([
        countDeliveriesGlobal(db, sinceSql),
        countPortalNotifGlobal(db, sinceSql),
        countOutboxDispatchedGlobal(db, sinceSql),
      ]);
    }
    windows.push({
      window: key,
      deliveries_created: deliveries,
      portal_notifications_created: portalN,
      outbox_dispatched: outbox,
    });
  }

  return { generated_at: new Date().toISOString(), windows };
}

export type DailyRollupRow = {
  day_utc: string;
  deliveries_created: number;
  portal_notifications_created: number;
};

export async function notificationMetricsDailyRollupUtc(
  db: Queryable,
  params: { days: number; landlordUserId: string | null }
): Promise<DailyRollupRow[]> {
  const safeDays = Math.max(1, Math.min(params.days, 90));
  const landlordId = params.landlordUserId;

  if (landlordId) {
    const rDel = await db.query<{ day_utc: string; c: number }>(
      `SELECT CONVERT(VARCHAR(10), CAST(nd.created_at AS DATE), 23) AS day_utc,
              COUNT(*) AS c
       FROM notification_deliveries nd
       INNER JOIN notification_outbox no ON no.id = nd.outbox_id
       OUTER APPLY (
         SELECT TRY_CAST(JSON_VALUE(no.payload, '$.request_id') AS UNIQUEIDENTIFIER) AS rid
       ) AS j
       INNER JOIN maintenance_requests mr ON mr.id = j.rid
       INNER JOIN properties p ON p.id = mr.property_id
       WHERE nd.created_at >= DATEADD(DAY, -$1, CAST(GETUTCDATE() AS DATE))
         AND j.rid IS NOT NULL
         AND mr.deleted_at IS NULL
         AND p.created_by = $2
       GROUP BY CAST(nd.created_at AS DATE)`,
      [safeDays, landlordId]
    );
    const rPn = await db.query<{ day_utc: string; c: number }>(
      `SELECT CONVERT(VARCHAR(10), CAST(pne.occurred_at AS DATE), 23) AS day_utc,
              COUNT(*) AS c
       FROM portal_notification_events pne
       INNER JOIN maintenance_requests mr ON mr.id = pne.request_id AND mr.deleted_at IS NULL
       INNER JOIN properties p ON p.id = mr.property_id
       WHERE pne.occurred_at >= DATEADD(DAY, -$1, CAST(GETUTCDATE() AS DATE))
         AND p.created_by = $2
       GROUP BY CAST(pne.occurred_at AS DATE)`,
      [safeDays, landlordId]
    );
    const delMap = new Map(rDel.rows.map((row) => [String(row.day_utc), Number(row.c ?? 0)]));
    const pnMap = new Map(rPn.rows.map((row) => [String(row.day_utc), Number(row.c ?? 0)]));
    const days = new Set([...delMap.keys(), ...pnMap.keys()]);
    return [...days]
      .sort()
      .map((day) => ({
        day_utc: day,
        deliveries_created: delMap.get(day) ?? 0,
        portal_notifications_created: pnMap.get(day) ?? 0,
      }));
  }

  const dayOffsets = Array.from({ length: safeDays }, (_, i) => `(${i})`).join(',');
  const r = await db.query<{
    day_utc: string;
    deliveries_created: number;
    portal_notifications_created: number;
  }>(
    `SELECT CONVERT(VARCHAR(10), bucket.d, 23) AS day_utc,
            ISNULL(d.c, 0) AS deliveries_created,
            ISNULL(p.c, 0) AS portal_notifications_created
     FROM (
       SELECT CAST(DATEADD(DAY, -n, CAST(GETUTCDATE() AS DATE)) AS DATE) AS d
       FROM (VALUES ${dayOffsets}) AS x(n)
     ) bucket
     LEFT JOIN (
       SELECT CAST(created_at AS DATE) AS d, COUNT(*) AS c
       FROM notification_deliveries
       WHERE created_at >= DATEADD(DAY, -$1, CAST(GETUTCDATE() AS DATE))
       GROUP BY CAST(created_at AS DATE)
     ) d ON d.d = bucket.d
     LEFT JOIN (
       SELECT CAST(occurred_at AS DATE) AS d, COUNT(*) AS c
       FROM portal_notification_events
       WHERE occurred_at >= DATEADD(DAY, -$1, CAST(GETUTCDATE() AS DATE))
       GROUP BY CAST(occurred_at AS DATE)
     ) p ON p.d = bucket.d
     WHERE bucket.d >= DATEADD(DAY, -$1, CAST(GETUTCDATE() AS DATE))
     ORDER BY bucket.d ASC`,
    [safeDays]
  );
  return r.rows.map((row) => ({
    day_utc: String(row.day_utc),
    deliveries_created: Number(row.deliveries_created ?? 0),
    portal_notifications_created: Number(row.portal_notifications_created ?? 0),
  }));
}
