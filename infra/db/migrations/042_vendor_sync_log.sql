-- Vendor sync log: records actual invoiced costs fetched from vendor billing APIs.
-- Populated nightly by the vendor-sync job (Phase 3).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'vendor_sync_log' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.vendor_sync_log (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    synced_at           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    vendor              VARCHAR(50)       NOT NULL,
    billing_date        DATE              NOT NULL,
    status              VARCHAR(20)       NOT NULL
                        CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL', 'NO_CREDENTIALS', 'ESTIMATED')),
    actual_cost_usd     DECIMAL(18, 8)    NULL,
    estimated_cost_usd  DECIMAL(18, 8)    NULL,
    currency            VARCHAR(10)       NOT NULL DEFAULT 'USD',
    error_message       NVARCHAR(MAX)     NULL,
    raw_data            NVARCHAR(MAX)     NULL
  );

  CREATE INDEX idx_vendor_sync_log_vendor_date
    ON dbo.vendor_sync_log (vendor, billing_date DESC);

  CREATE INDEX idx_vendor_sync_log_synced_at
    ON dbo.vendor_sync_log (synced_at DESC);
END;
