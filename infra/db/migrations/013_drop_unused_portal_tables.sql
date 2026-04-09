-- Drop unused legacy portal tables that are no longer referenced by API/UI code.
-- Idempotent: safe to re-run.

IF OBJECT_ID('dbo.notification_rules', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.notification_rules;
END;

IF OBJECT_ID('dbo.notification_event_types', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.notification_event_types;
END;

IF OBJECT_ID('dbo.notification_deliveries', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.notification_deliveries;
END;

IF OBJECT_ID('dbo.property_listing_sync_jobs', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.property_listing_sync_jobs;
END;

IF OBJECT_ID('dbo.message_attachments', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.message_attachments;
END;

IF OBJECT_ID('dbo.canned_responses', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.canned_responses;
END;
