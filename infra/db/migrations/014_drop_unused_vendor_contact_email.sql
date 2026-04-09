-- Drop unused legacy vendor contact email column on maintenance requests.
-- Idempotent: safe to re-run.

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.maintenance_requests')
    AND name = 'vendor_contact_email'
)
BEGIN
  ALTER TABLE dbo.maintenance_requests
    DROP COLUMN vendor_contact_email;
END;
