-- ---------------------------------------------------------------------------
-- Support tickets: portal users submit tickets (bugs, features, questions,
-- complaints). Admins triage via threaded replies, status, priority, assignee.
-- Attachments reuse the same Azure Blob container as request attachments.
-- ---------------------------------------------------------------------------

-- Part A: support_tickets
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'support_tickets' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE support_tickets (
    id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id           UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id),
    category          NVARCHAR(20)      NOT NULL
                        CHECK (category IN ('BUG', 'FEATURE', 'QUESTION', 'COMPLAINT')),
    area              NVARCHAR(40)      NULL,
    title             NVARCHAR(200)     NOT NULL,
    description_markdown NVARCHAR(MAX)  NOT NULL,
    status            NVARCHAR(20)      NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    priority          NVARCHAR(10)      NULL
                        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    assignee_user_id  UNIQUEIDENTIFIER  NULL REFERENCES users (id),
    diagnostics_json  NVARCHAR(MAX)     NULL,
    last_activity_at  DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    resolved_at       DATETIMEOFFSET    NULL,
    closed_at         DATETIMEOFFSET    NULL,
    created_at        DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at        DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_support_tickets_user_status
    ON support_tickets (user_id, status, last_activity_at DESC);
  CREATE INDEX idx_support_tickets_status_activity
    ON support_tickets (status, last_activity_at DESC);
  CREATE INDEX idx_support_tickets_assignee
    ON support_tickets (assignee_user_id, status);
END;

-- Part B: support_ticket_messages (threaded replies + internal notes)
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'support_ticket_messages' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE support_ticket_messages (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ticket_id       UNIQUEIDENTIFIER  NOT NULL
                      REFERENCES support_tickets (id) ON DELETE CASCADE,
    author_user_id  UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id),
    author_role     NVARCHAR(20)      NOT NULL
                      CHECK (author_role IN ('ADMIN', 'LANDLORD', 'TENANT', 'AI_AGENT')),
    body_markdown   NVARCHAR(MAX)     NOT NULL,
    is_internal_note BIT              NOT NULL DEFAULT 0,
    read_by_recipient_at DATETIMEOFFSET NULL,
    created_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_support_ticket_messages_ticket
    ON support_ticket_messages (ticket_id, created_at);
END;

-- Part C: support_ticket_attachments
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'support_ticket_attachments' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE support_ticket_attachments (
    id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ticket_id           UNIQUEIDENTIFIER NOT NULL
                          REFERENCES support_tickets (id) ON DELETE CASCADE,
    message_id          UNIQUEIDENTIFIER NULL
                          REFERENCES support_ticket_messages (id),
    uploaded_by_user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users (id),
    storage_path        NVARCHAR(500)    NOT NULL,
    original_filename   NVARCHAR(260)    NOT NULL,
    content_type        NVARCHAR(100)    NOT NULL,
    file_size_bytes     BIGINT           NOT NULL,
    finalized_at        DATETIMEOFFSET   NULL,
    created_at          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_support_ticket_attachments_ticket
    ON support_ticket_attachments (ticket_id, created_at);
END;

-- Part D: support_ticket_status_events (audit trail of status/priority/assignee changes)
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'support_ticket_status_events' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE support_ticket_status_events (
    id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ticket_id       UNIQUEIDENTIFIER NOT NULL
                      REFERENCES support_tickets (id) ON DELETE CASCADE,
    actor_user_id   UNIQUEIDENTIFIER NOT NULL REFERENCES users (id),
    field_name      NVARCHAR(40)     NOT NULL
                      CHECK (field_name IN ('status', 'priority', 'assignee', 'area', 'category')),
    from_value      NVARCHAR(100)    NULL,
    to_value        NVARCHAR(100)    NULL,
    created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_support_ticket_status_events_ticket
    ON support_ticket_status_events (ticket_id, created_at DESC);
END;
