-- Subscription tiers for the portal SaaS offering + public contact request intake.

-- Part A: subscription_tiers table with seeded FREE / STARTER / PRO defaults
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subscription_tiers' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE subscription_tiers (
    id           UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name         NVARCHAR(20)      NOT NULL,
    display_name NVARCHAR(100)     NOT NULL,
    description  NVARCHAR(MAX)     NULL,
    limits       NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    is_active    BIT               NOT NULL DEFAULT 1,
    created_at   DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_subscription_tiers_name UNIQUE (name)
  );

  INSERT INTO subscription_tiers (id, name, display_name, description, limits) VALUES
    (NEWID(), 'FREE', 'Free', 'Get started at no cost',
     N'{"max_properties":1,"max_tenants":5,"ai_routing_enabled":false,"csv_export_enabled":false,"custom_notifications_enabled":false,"notification_channels":["in_app"],"maintenance_request_history_days":90}'),
    (NEWID(), 'STARTER', 'Starter', 'For growing portfolios',
     N'{"max_properties":5,"max_tenants":25,"ai_routing_enabled":true,"csv_export_enabled":true,"custom_notifications_enabled":false,"notification_channels":["in_app","email"],"maintenance_request_history_days":-1}'),
    (NEWID(), 'PRO', 'Pro', 'For established property managers',
     N'{"max_properties":-1,"max_tenants":-1,"ai_routing_enabled":true,"csv_export_enabled":true,"custom_notifications_enabled":true,"notification_channels":["in_app","email","sms"],"maintenance_request_history_days":-1}');
END;

-- Part B: users.tier_id FK to subscription_tiers
IF COL_LENGTH('dbo.users', 'tier_id') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD tier_id UNIQUEIDENTIFIER NULL
      REFERENCES subscription_tiers (id) ON DELETE SET NULL;
END;

-- Part C: contact_requests table for marketing intake form
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'contact_requests' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE contact_requests (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    name            NVARCHAR(200)     NOT NULL,
    email           NVARCHAR(320)     NOT NULL,
    phone           NVARCHAR(50)      NULL,
    subject         NVARCHAR(100)     NOT NULL,
    message         NVARCHAR(MAX)     NOT NULL,
    status          NVARCHAR(20)      NOT NULL DEFAULT 'UNREAD'
                    CHECK (status IN ('UNREAD', 'READ', 'HANDLED')),
    recaptcha_score FLOAT             NULL,
    ip_address      NVARCHAR(64)      NULL,
    created_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_contact_requests_status_created
    ON contact_requests (status, created_at DESC);
END;
