-- Optional JSON payload for queued deliveries (admin test sends, future templating).
IF COL_LENGTH('dbo.notification_deliveries', 'payload_json') IS NULL
BEGIN
  ALTER TABLE dbo.notification_deliveries ADD payload_json NVARCHAR(MAX) NULL;
END;
