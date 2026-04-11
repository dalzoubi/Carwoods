-- Phase 1 notification center persistence and expanded event catalog.

-- ---------------------------------------------------------------------------
-- portal_notifications
-- ---------------------------------------------------------------------------

IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'portal_notifications' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE portal_notifications (
    id                 UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id            UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_type_code    NVARCHAR(100)     NOT NULL,
    title              NVARCHAR(300)     NOT NULL,
    body               NVARCHAR(MAX)     NOT NULL,
    deep_link          NVARCHAR(500)     NULL,
    request_id         UNIQUEIDENTIFIER  NULL,
    metadata_json      NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    read_at            DATETIMEOFFSET    NULL,
    created_at         DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_portal_notifications_user_created
    ON portal_notifications (user_id, created_at DESC);

  CREATE INDEX idx_portal_notifications_user_unread
    ON portal_notifications (user_id, read_at, created_at DESC);
END;

-- ---------------------------------------------------------------------------
-- notification event type catalog extension
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.notification_event_types', 'U') IS NOT NULL
BEGIN
  MERGE notification_event_types AS target
  USING (VALUES
    ('ACCOUNT_ONBOARDED_WELCOME', 'Account onboarded welcome'),
    ('ACCOUNT_EMAIL_VERIFICATION', 'Account email verification'),
    ('REQUEST_MESSAGE_CREATED', 'Request message created'),
    ('REQUEST_CREATED', 'Request created'),
    ('REQUEST_UPDATED', 'Request updated')
  ) AS src (code, name)
    ON target.code = src.code
  WHEN NOT MATCHED THEN
    INSERT (id, code, name, active)
    VALUES (NEWID(), src.code, src.name, 1);
END;
