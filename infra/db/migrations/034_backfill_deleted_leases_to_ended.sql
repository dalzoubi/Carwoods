-- Backfill: the previous tenant-delete flow soft-deleted single-tenant leases via
-- `leases.deleted_at`, losing rent ledger / request / audit history from the UI. We now
-- want "ended" (ENDED status + ended_on) for move-outs, and reserve deleted_at for true
-- "created by mistake" cases.
--
-- Strategy (conservative, idempotent):
--   * For every lease with deleted_at IS NOT NULL that still has any lease_tenants links,
--     restore deleted_at to NULL and stamp status='ENDED', ended_on = deleted_at (date part),
--     ended_reason='other', ended_notes='backfilled from soft-deleted lease (migration 034)'.
--   * Skip leases already ENDED/TERMINATED or with ended_on already set — safe to re-run.
--   * Leases with zero lease_tenants links are left soft-deleted (truly mistaken rows).

UPDATE l
   SET l.deleted_at   = NULL,
       l.status       = 'ENDED',
       l.ended_on     = COALESCE(l.ended_on, CAST(l.deleted_at AS DATE)),
       l.ended_reason = COALESCE(l.ended_reason, 'other'),
       l.ended_notes  = COALESCE(l.ended_notes, N'backfilled from soft-deleted lease (migration 034)'),
       l.updated_at   = GETUTCDATE()
  FROM dbo.leases l
 WHERE l.deleted_at IS NOT NULL
   AND l.ended_on IS NULL
   AND EXISTS (SELECT 1 FROM dbo.lease_tenants lt WHERE lt.lease_id = l.id);
GO
