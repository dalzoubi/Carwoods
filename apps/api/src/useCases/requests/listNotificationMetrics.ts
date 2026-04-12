import { forbidden } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import {
  aggregateNotificationMetricsForWindows,
  notificationMetricsDailyRollupUtc,
} from '../../lib/notificationMetricsRepo.js';
import type { Queryable } from '../types.js';

export type ListNotificationMetricsInput = {
  actorRole: string;
  actorUserId: string;
};

export async function listNotificationMetrics(db: Queryable, input: ListNotificationMetricsInput) {
  const role = input.actorRole.trim().toUpperCase();
  if (role !== Role.ADMIN && role !== Role.LANDLORD) throw forbidden();
  const landlordUserId = role === Role.LANDLORD ? input.actorUserId : null;

  const windows = await aggregateNotificationMetricsForWindows(db, { landlordUserId });
  const dailyRollupUtc = await notificationMetricsDailyRollupUtc(db, { days: 30, landlordUserId });

  return {
    ...windows,
    daily_rollup_utc: dailyRollupUtc,
    scope: landlordUserId ? 'landlord_properties' : 'global',
    hybrid_reporting: {
      operational_target_latency_minutes: 1,
      daily_boundary: 'UTC_date_via_SWITCHOFFSET_to_+00_00',
      note:
        'Operational windows use live counts (target freshness within one minute of DB clock). ' +
        'Daily rows group by UTC calendar day; per-recipient timezone rollups can extend this pipeline later.',
    },
  };
}
