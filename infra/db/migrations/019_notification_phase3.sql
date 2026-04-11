-- ---------------------------------------------------------------------------
-- Phase 3: operational intelligence — backoff, cooldowns, SMS scheduling,
-- quiet-hours prefs, AI signal audit support
-- ---------------------------------------------------------------------------

-- notification_outbox: retry scheduling + idempotent admin alert flag
IF COL_LENGTH('dbo.notification_outbox', 'next_attempt_at') IS NULL
BEGIN
  ALTER TABLE notification_outbox ADD next_attempt_at DATETIMEOFFSET NULL;
END;

IF COL_LENGTH('dbo.notification_outbox', 'admin_failure_alert_sent') IS NULL
BEGIN
  ALTER TABLE notification_outbox ADD admin_failure_alert_sent BIT NOT NULL DEFAULT 0;
END;

-- notification_deliveries: recreated here if missing (013 dropped legacy copy); else add column.
IF OBJECT_ID('dbo.notification_deliveries', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.notification_deliveries (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    outbox_id           UNIQUEIDENTIFIER  NULL REFERENCES dbo.notification_outbox (id) ON DELETE SET NULL,
    recipient_email     NVARCHAR(320)     NOT NULL,
    template_id         NVARCHAR(200)     NULL,
    status              NVARCHAR(20)      NOT NULL
                        CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
    provider_message_id NVARCHAR(500)     NULL,
    error               NVARCHAR(MAX)     NULL,
    created_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    scheduled_send_at   DATETIMEOFFSET    NULL
  );

  CREATE INDEX idx_notification_deliveries_outbox ON dbo.notification_deliveries (outbox_id);
END
ELSE IF COL_LENGTH('dbo.notification_deliveries', 'scheduled_send_at') IS NULL
BEGIN
  ALTER TABLE dbo.notification_deliveries ADD scheduled_send_at DATETIMEOFFSET NULL;
END;

-- Per-user per-request per-channel last fire (15-minute cooldown enforcement)
IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'notification_channel_cooldowns' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE notification_channel_cooldowns (
    user_id     UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    request_id  UNIQUEIDENTIFIER NOT NULL,
    channel     NVARCHAR(20)     NOT NULL
                CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP')),
    last_fired_at DATETIMEOFFSET NOT NULL,
    CONSTRAINT pk_notification_channel_cooldowns PRIMARY KEY (user_id, request_id, channel)
  );

  CREATE INDEX idx_notification_channel_cooldowns_fired
    ON notification_channel_cooldowns (user_id, request_id, channel, last_fired_at DESC);
END;

-- Optional per-user quiet-hours override (NULLs = use global America/Chicago 20:00–06:00)
IF COL_LENGTH('dbo.user_notification_preferences', 'quiet_hours_timezone') IS NULL
BEGIN
  ALTER TABLE user_notification_preferences ADD quiet_hours_timezone NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'quiet_hours_start_minute') IS NULL
BEGIN
  ALTER TABLE user_notification_preferences ADD quiet_hours_start_minute INT NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'quiet_hours_end_minute') IS NULL
BEGIN
  ALTER TABLE user_notification_preferences ADD quiet_hours_end_minute INT NULL;
END;

-- Optional audit row for AI urgency/summary decisions tied to an outbox message
IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'notification_ai_signals' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE notification_ai_signals (
    id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    outbox_id         UNIQUEIDENTIFIER NOT NULL REFERENCES notification_outbox (id) ON DELETE CASCADE,
    request_id        UNIQUEIDENTIFIER NULL,
    summary_text      NVARCHAR(200)    NOT NULL,
    urgent            BIT              NOT NULL DEFAULT 0,
    confidence        DECIMAL(5,4)     NOT NULL,
    model_name        NVARCHAR(200)    NOT NULL,
    provider_used     NVARCHAR(50)     NOT NULL,
    priority_override_applied BIT      NOT NULL DEFAULT 0,
    error_detail      NVARCHAR(500)    NULL,
    created_at        DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_notification_ai_signals_outbox
    ON notification_ai_signals (outbox_id);
END;

IF OBJECT_ID('dbo.notification_event_types', 'U') IS NOT NULL
BEGIN
  MERGE notification_event_types AS target
  USING (VALUES
    ('SECURITY_NOTIFICATION_DELIVERY_FAILURE', 'Security: repeated notification delivery failure')
  ) AS src (code, name)
    ON target.code = src.code
  WHEN NOT MATCHED THEN
    INSERT (id, code, name, active)
    VALUES (NEWID(), src.code, src.name, 1);
END;
