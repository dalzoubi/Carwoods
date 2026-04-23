import type { QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type CostService = 'RESEND_EMAIL' | 'TELNYX_SMS' | 'GEMINI_AI' | 'AZURE_INFRASTRUCTURE';
export type CostUnitType = 'EMAIL' | 'SMS' | 'TOKEN' | 'DAY' | 'GB';

export type CostEventInput = {
  service: CostService;
  landlordId?: string | null;
  propertyId?: string | null;
  units: number;
  unitType: CostUnitType;
  estimatedCostUsd: number;
  providerMessageId?: string | null;
  metadata?: Record<string, unknown>;
};

export type PricingRates = Map<CostService, number>;

export async function getPricingRates(db: Queryable): Promise<PricingRates> {
  const rates: PricingRates = new Map();
  try {
    const r = await db.query<{ service: string; rate_usd: number }>(
      `SELECT service, rate_usd FROM pricing_config`
    );
    for (const row of r.rows) {
      rates.set(row.service as CostService, Number(row.rate_usd));
    }
  } catch {
    // return empty map — caller falls back to 0
  }
  return rates;
}

export async function getLandlordForProperty(
  db: Queryable,
  propertyId: string
): Promise<string | null> {
  try {
    const r = await db.query<{ landlord_id: string }>(
      `SELECT created_by AS landlord_id FROM properties WHERE id = $1 AND deleted_at IS NULL`,
      [propertyId]
    );
    return r.rows[0]?.landlord_id ?? null;
  } catch {
    return null;
  }
}

export async function logCostEvent(db: Queryable, event: CostEventInput): Promise<void> {
  try {
    await db.query(
      `INSERT INTO cost_events
         (service, landlord_id, property_id, units, unit_type, estimated_cost_usd, provider_message_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.service,
        event.landlordId ?? null,
        event.propertyId ?? null,
        event.units,
        event.unitType,
        event.estimatedCostUsd,
        event.providerMessageId ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ]
    );
  } catch {
    // never let cost logging break the main flow
  }
}
