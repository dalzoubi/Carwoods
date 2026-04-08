-- Add schedule window fields for maintenance requests.
-- Idempotent: safe to re-run.

IF COL_LENGTH('dbo.maintenance_requests', 'scheduled_from') IS NULL
BEGIN
  ALTER TABLE dbo.maintenance_requests
  ADD scheduled_from DATETIMEOFFSET NULL;
END

IF COL_LENGTH('dbo.maintenance_requests', 'scheduled_to') IS NULL
BEGIN
  ALTER TABLE dbo.maintenance_requests
  ADD scheduled_to DATETIMEOFFSET NULL;
END

-- Backfill start value from legacy single-point schedule column.
UPDATE dbo.maintenance_requests
SET scheduled_from = scheduled_for
WHERE scheduled_for IS NOT NULL
  AND scheduled_from IS NULL;
