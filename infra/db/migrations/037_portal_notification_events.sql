-- Immutable issuance log for in-app portal notifications (metrics survive inbox deletes).

IF OBJECT_ID('dbo.portal_notification_events', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.portal_notification_events (
    id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_portal_notification_events PRIMARY KEY DEFAULT NEWID(),
    occurred_at          DATETIMEOFFSET   NOT NULL,
    user_id              UNIQUEIDENTIFIER NOT NULL,
    event_type_code      NVARCHAR(100)    NOT NULL,
    request_id           UNIQUEIDENTIFIER NULL,
    portal_notification_id UNIQUEIDENTIFIER NULL,
    outbox_id            UNIQUEIDENTIFIER NULL,
    CONSTRAINT fk_pne_user FOREIGN KEY (user_id) REFERENCES dbo.users (id)
  );
END;

-- Backfill from existing inbox rows (one event per notification).
INSERT INTO dbo.portal_notification_events (
  occurred_at,
  user_id,
  event_type_code,
  request_id,
  portal_notification_id,
  outbox_id
)
SELECT
  pn.created_at,
  pn.user_id,
  pn.event_type_code,
  pn.request_id,
  pn.id,
  CASE
    WHEN ISJSON(pn.metadata_json) = 1
      THEN TRY_CAST(LTRIM(RTRIM(JSON_VALUE(pn.metadata_json, '$.outbox_id'))) AS UNIQUEIDENTIFIER)
    ELSE NULL
  END
FROM dbo.portal_notifications pn
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.portal_notification_events e
  WHERE e.portal_notification_id = pn.id
);

-- Link to inbox row; SET NULL when user deletes from inbox (events remain for metrics).
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_pne_portal_notification' AND parent_object_id = OBJECT_ID('dbo.portal_notification_events')
)
BEGIN
  ALTER TABLE dbo.portal_notification_events
    ADD CONSTRAINT fk_pne_portal_notification
      FOREIGN KEY (portal_notification_id) REFERENCES dbo.portal_notifications (id) ON DELETE SET NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'uq_pne_portal_notification_id' AND object_id = OBJECT_ID('dbo.portal_notification_events')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX uq_pne_portal_notification_id
    ON dbo.portal_notification_events (portal_notification_id)
    WHERE portal_notification_id IS NOT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'idx_pne_occurred' AND object_id = OBJECT_ID('dbo.portal_notification_events')
)
BEGIN
  CREATE NONCLUSTERED INDEX idx_pne_occurred
    ON dbo.portal_notification_events (occurred_at);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'idx_pne_user_occurred' AND object_id = OBJECT_ID('dbo.portal_notification_events')
)
BEGIN
  CREATE NONCLUSTERED INDEX idx_pne_user_occurred
    ON dbo.portal_notification_events (user_id, occurred_at);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'idx_pne_event_occurred' AND object_id = OBJECT_ID('dbo.portal_notification_events')
)
BEGIN
  CREATE NONCLUSTERED INDEX idx_pne_event_occurred
    ON dbo.portal_notification_events (event_type_code, occurred_at);
END;
