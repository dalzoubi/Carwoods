import type { QueryResult } from './db.js';

export type TierLimits = {
  max_properties: number;               // -1 = unlimited
  max_tenants: number;                  // -1 = unlimited
  ai_routing_enabled: boolean;
  csv_export_enabled: boolean;
  custom_notifications_enabled: boolean;
  notification_channels: string[];      // ['in_app', 'email', 'sms']
  maintenance_request_history_days: number; // -1 = unlimited
};

export type TierRow = {
  id: string;
  name: string;        // FREE | STARTER | PRO
  display_name: string;
  description: string | null;
  limits: TierLimits;  // auto-parsed by db.ts JSON_COLUMNS
  is_active: boolean;
  created_at: string;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const TIER_COLUMNS = `id, name, display_name, description, limits, is_active, created_at`;

export async function listTiers(db: Queryable): Promise<TierRow[]> {
  const r = await db.query<TierRow>(
    `SELECT ${TIER_COLUMNS} FROM subscription_tiers ORDER BY
     CASE name WHEN 'FREE' THEN 1 WHEN 'STARTER' THEN 2 WHEN 'PRO' THEN 3 ELSE 4 END`
  );
  return r.rows;
}

export async function getTierByName(db: Queryable, name: string): Promise<TierRow | null> {
  const r = await db.query<TierRow>(
    `SELECT ${TIER_COLUMNS} FROM subscription_tiers WHERE name = $1`,
    [name]
  );
  return r.rows[0] ?? null;
}

export async function getTierById(db: Queryable, id: string): Promise<TierRow | null> {
  const r = await db.query<TierRow>(
    `SELECT ${TIER_COLUMNS} FROM subscription_tiers WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function updateTier(
  db: Queryable,
  id: string,
  patch: {
    display_name?: string;
    description?: string | null;
    limits?: Partial<TierLimits>;
  }
): Promise<TierRow | null> {
  // Fetch current row first so we can merge limits
  const current = await getTierById(db, id);
  if (!current) return null;

  const newLimits: TierLimits = {
    ...current.limits,
    ...(patch.limits ?? {}),
  };
  const newDisplayName = patch.display_name ?? current.display_name;
  const newDescription = patch.description !== undefined ? patch.description : current.description;

  const r = await db.query<TierRow>(
    `UPDATE subscription_tiers
     SET display_name = $2,
         description  = $3,
         limits       = $4
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.display_name, INSERTED.description,
            INSERTED.limits, INSERTED.is_active, INSERTED.created_at
     WHERE id = $1`,
    [id, newDisplayName, newDescription, JSON.stringify(newLimits)]
  );
  return r.rows[0] ?? null;
}
