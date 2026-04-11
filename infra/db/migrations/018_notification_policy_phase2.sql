-- ---------------------------------------------------------------------------
-- Phase 2 notification policy controls
-- ---------------------------------------------------------------------------

IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'user_notification_preferences' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE user_notification_preferences (
    user_id           UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    email_enabled     BIT               NOT NULL DEFAULT 1,
    in_app_enabled    BIT               NOT NULL DEFAULT 1,
    sms_enabled       BIT               NOT NULL DEFAULT 0,
    sms_opt_in        BIT               NOT NULL DEFAULT 0,
    created_at        DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at        DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'notification_scope_overrides' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE notification_scope_overrides (
    id                    UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    scope_type            NVARCHAR(20)      NOT NULL
                          CHECK (scope_type IN ('PROPERTY', 'REQUEST')),
    scope_id              UNIQUEIDENTIFIER  NOT NULL,
    user_id               UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_category        NVARCHAR(40)      NOT NULL
                          CHECK (event_category IN ('ONBOARDING', 'MAINTENANCE', 'SECURITY_COMPLIANCE')),
    email_enabled         BIT               NULL,
    in_app_enabled        BIT               NULL,
    sms_enabled           BIT               NULL,
    sms_opt_in            BIT               NULL,
    override_reason       NVARCHAR(1000)    NOT NULL,
    overridden_by_user_id UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    active                BIT               NOT NULL DEFAULT 1,
    created_at            DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at            DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_notification_scope_overrides UNIQUE (scope_type, scope_id, user_id, event_category)
  );

  CREATE INDEX idx_notification_scope_overrides_lookup
    ON notification_scope_overrides (scope_type, scope_id, user_id, event_category, active, updated_at DESC);
END;
