-- Cost tracking: per-action event log, daily rollup, pricing config, and landlord billing plans.

-- ---------------------------------------------------------------------------
-- pricing_config: admin-managed cost rate per service
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'pricing_config' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.pricing_config (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    service        NVARCHAR(50)      NOT NULL,
    unit_type      NVARCHAR(20)      NOT NULL CHECK (unit_type IN ('EMAIL', 'SMS', 'TOKEN', 'DAY', 'GB')),
    rate_usd       DECIMAL(18, 8)    NOT NULL,
    description    NVARCHAR(500)     NULL,
    updated_at     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_by     UNIQUEIDENTIFIER  NULL REFERENCES dbo.users (id) ON DELETE SET NULL,
    CONSTRAINT uq_pricing_config_service UNIQUE (service)
  );

  -- Seed with current market rates (admin can update via UI in Phase 4)
  INSERT INTO dbo.pricing_config (service, unit_type, rate_usd, description) VALUES
    ('RESEND_EMAIL',          'EMAIL', 0.00100000, 'Resend: $1.00 per 1,000 emails'),
    ('TELNYX_SMS',            'SMS',   0.00400000, 'Telnyx: $0.004 per SMS segment'),
    ('GEMINI_AI',             'TOKEN', 0.00000025, 'Gemini 2.5 Flash: blended ~$0.25 per 1M tokens'),
    ('AZURE_INFRASTRUCTURE',  'DAY',   0.00000000, 'Actual costs fetched nightly from Azure Cost Management API (stored in vendor_sync_log). This rate is not used for event logging — it serves as a reference only.');
END;

-- ---------------------------------------------------------------------------
-- cost_events: one row per billable action
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'cost_events' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.cost_events (
    id                   UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    occurred_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    service              NVARCHAR(50)      NOT NULL
                         CHECK (service IN ('RESEND_EMAIL', 'TELNYX_SMS', 'GEMINI_AI', 'AZURE_INFRASTRUCTURE')),
    landlord_id          UNIQUEIDENTIFIER  NULL REFERENCES dbo.users (id) ON DELETE SET NULL,
    property_id          UNIQUEIDENTIFIER  NULL REFERENCES dbo.properties (id) ON DELETE SET NULL,
    units                FLOAT             NOT NULL DEFAULT 1,
    unit_type            NVARCHAR(20)      NOT NULL CHECK (unit_type IN ('EMAIL', 'SMS', 'TOKEN', 'DAY', 'GB')),
    estimated_cost_usd   DECIMAL(18, 8)    NOT NULL DEFAULT 0,
    provider_message_id  NVARCHAR(500)     NULL,
    metadata             NVARCHAR(MAX)     NULL
  );

  CREATE INDEX idx_cost_events_landlord_date
    ON dbo.cost_events (landlord_id, occurred_at DESC)
    WHERE landlord_id IS NOT NULL;

  CREATE INDEX idx_cost_events_service_date
    ON dbo.cost_events (service, occurred_at DESC);

  CREATE INDEX idx_cost_events_property_date
    ON dbo.cost_events (property_id, occurred_at DESC)
    WHERE property_id IS NOT NULL;

  CREATE INDEX idx_cost_events_occurred_at
    ON dbo.cost_events (occurred_at DESC);
END;

-- ---------------------------------------------------------------------------
-- cost_daily_rollup: pre-aggregated daily totals per landlord+property+service
-- Populated by the nightly aggregation job (Phase 2).
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'cost_daily_rollup' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.cost_daily_rollup (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    rollup_date     DATE              NOT NULL,
    landlord_id     UNIQUEIDENTIFIER  NULL REFERENCES dbo.users (id) ON DELETE SET NULL,
    property_id     UNIQUEIDENTIFIER  NULL REFERENCES dbo.properties (id) ON DELETE SET NULL,
    service         NVARCHAR(50)      NOT NULL,
    event_count     INT               NOT NULL DEFAULT 0,
    total_units     FLOAT             NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(18, 8)    NOT NULL DEFAULT 0,
    last_updated_at DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_cost_daily_rollup UNIQUE (rollup_date, landlord_id, property_id, service)
  );

  CREATE INDEX idx_cost_daily_rollup_landlord
    ON dbo.cost_daily_rollup (landlord_id, rollup_date DESC)
    WHERE landlord_id IS NOT NULL;

  CREATE INDEX idx_cost_daily_rollup_date
    ON dbo.cost_daily_rollup (rollup_date DESC);
END;

-- ---------------------------------------------------------------------------
-- landlord_billing: per-landlord billing plan and revenue rates
-- Managed by admin in Phase 4 UI.
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'landlord_billing' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.landlord_billing (
    landlord_id        UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY REFERENCES dbo.users (id) ON DELETE CASCADE,
    tier_name          NVARCHAR(20)      NOT NULL DEFAULT 'PAY_AS_YOU_GROW'
                       CHECK (tier_name IN ('PAY_AS_YOU_GROW', 'PRO')),
    per_property_rate  DECIMAL(10, 2)    NULL,
    flat_monthly_rate  DECIMAL(10, 2)    NULL,
    billing_cycle_day  INT               NOT NULL DEFAULT 1
                       CHECK (billing_cycle_day BETWEEN 1 AND 28),
    notes              NVARCHAR(1000)    NULL,
    created_at         DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at         DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
