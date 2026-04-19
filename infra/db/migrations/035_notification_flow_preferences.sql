-- ---------------------------------------------------------------------------
-- Per-flow notification channel preferences.
--
-- Sparse table: rows only exist for event codes where the user has overridden
-- at least one channel default from apps/api/src/config/notificationFlowDefaults.ts.
-- Global toggles remain in user_notification_preferences and apply when no
-- per-flow row exists for a given event code.
-- ---------------------------------------------------------------------------

IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'user_notification_flow_preferences' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE user_notification_flow_preferences (
    user_id           UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_type_code   NVARCHAR(64)      NOT NULL,
    email_enabled     BIT               NULL,
    in_app_enabled    BIT               NULL,
    sms_enabled       BIT               NULL,
    created_at        DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at        DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_user_notification_flow_preferences
      PRIMARY KEY (user_id, event_type_code)
  );

  CREATE INDEX idx_user_notification_flow_preferences_event
    ON user_notification_flow_preferences (event_type_code, user_id);
END;
