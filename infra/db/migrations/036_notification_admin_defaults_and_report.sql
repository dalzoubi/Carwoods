-- ---------------------------------------------------------------------------
-- Admin-tunable per-flow notification channel defaults.
--
-- Sparse rows: a row exists only when an admin has overridden the compile-time
-- default declared in apps/api/src/config/notificationFlowDefaults.ts.
-- Resolution order in resolveNotificationPolicy:
--   scope override > per-user flow pref > admin override (this table) > compile-time default
-- ---------------------------------------------------------------------------

IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'notification_flow_defaults_config' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE notification_flow_defaults_config (
    event_type_code     NVARCHAR(64)      NOT NULL PRIMARY KEY,
    email_enabled       BIT               NOT NULL,
    in_app_enabled      BIT               NOT NULL,
    sms_enabled         BIT               NOT NULL,
    quiet_hours_bypass  BIT               NULL,
    updated_by_user_id  UNIQUEIDENTIFIER  NULL REFERENCES users (id) ON DELETE SET NULL,
    updated_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

-- ---------------------------------------------------------------------------
-- Denormalized columns on notification_deliveries to power the report dashboard
-- without expensive joins / payload parsing.
-- ---------------------------------------------------------------------------

IF COL_LENGTH('dbo.notification_deliveries', 'channel') IS NULL
BEGIN
  ALTER TABLE notification_deliveries ADD channel NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.notification_deliveries', 'recipient_user_id') IS NULL
BEGIN
  ALTER TABLE notification_deliveries ADD recipient_user_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.notification_deliveries', 'event_type_code') IS NULL
BEGIN
  ALTER TABLE notification_deliveries ADD event_type_code NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.notification_deliveries', 'sent_at') IS NULL
BEGIN
  ALTER TABLE notification_deliveries ADD sent_at DATETIMEOFFSET NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_notification_deliveries_report'
    AND object_id = OBJECT_ID('dbo.notification_deliveries')
)
BEGIN
  CREATE INDEX idx_notification_deliveries_report
    ON notification_deliveries (created_at DESC, channel, status, event_type_code);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_notification_deliveries_recipient'
    AND object_id = OBJECT_ID('dbo.notification_deliveries')
)
BEGIN
  CREATE INDEX idx_notification_deliveries_recipient
    ON notification_deliveries (recipient_user_id, created_at DESC);
END;
