-- ---------------------------------------------------------------------------
-- Contact request replies: lets admins respond to public contact form
-- submissions from the portal. Each reply is stored here and (unless marked
-- internal) is emailed out to the original submitter via Resend. A small
-- template library lets admins reuse canned openers.
-- ---------------------------------------------------------------------------

-- Part A: contact_request_messages
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'contact_request_messages' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE contact_request_messages (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    contact_request_id  UNIQUEIDENTIFIER  NOT NULL
                          REFERENCES contact_requests (id) ON DELETE CASCADE,
    author_user_id      UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id),
    body                NVARCHAR(MAX)     NOT NULL,
    is_internal_note    BIT               NOT NULL DEFAULT 0,
    email_sent_at       DATETIMEOFFSET    NULL,
    email_provider_id   NVARCHAR(200)     NULL,
    email_error         NVARCHAR(500)     NULL,
    ai_suggested        BIT               NOT NULL DEFAULT 0,
    ai_model            NVARCHAR(100)     NULL,
    created_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_contact_request_messages_request
    ON contact_request_messages (contact_request_id, created_at);
END;

-- Part B: contact_reply_templates
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'contact_reply_templates' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE contact_reply_templates (
    id             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    title          NVARCHAR(200)    NOT NULL,
    body           NVARCHAR(MAX)    NOT NULL,
    subject_scope  NVARCHAR(100)    NULL,
    created_by     UNIQUEIDENTIFIER NOT NULL REFERENCES users (id),
    created_at     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_contact_reply_templates_scope
    ON contact_reply_templates (subject_scope, title);
END;
