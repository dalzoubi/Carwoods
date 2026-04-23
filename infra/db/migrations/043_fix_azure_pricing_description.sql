-- Clarify AZURE_INFRASTRUCTURE pricing_config description now that Phase 3
-- fetches actual costs directly from the Azure Cost Management API.
-- The rate_usd here is never used for event-level logging; real costs are
-- stored in vendor_sync_log by the nightly vendor sync job.

UPDATE dbo.pricing_config
SET
  description = 'Actual costs fetched nightly from Azure Cost Management API (stored in vendor_sync_log). This rate is not used for event logging — it serves as a reference only.',
  updated_at  = SYSDATETIMEOFFSET()
WHERE service = 'AZURE_INFRASTRUCTURE';
