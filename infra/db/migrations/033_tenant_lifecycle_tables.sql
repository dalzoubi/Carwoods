-- Tenant lifecycle support tables: move-out, eviction, notice, deposits,
-- re-rent blocks, and per-landlord portal-access grace windows.
--
-- Depends on 032_lease_move_out_fields.sql (lease columns).
-- Each table / index block is idempotent so partial applies can resume.

-- ---------------------------------------------------------------------------
-- lease_move_outs
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.lease_move_outs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.lease_move_outs (
    lease_id                 UNIQUEIDENTIFIER NOT NULL PRIMARY KEY
                             REFERENCES leases (id) ON DELETE NO ACTION,
    forwarding_street        NVARCHAR(500)    NULL,
    forwarding_street2       NVARCHAR(500)    NULL,
    forwarding_city          NVARCHAR(200)    NULL,
    forwarding_state         NVARCHAR(100)    NULL,
    forwarding_zip           NVARCHAR(20)     NULL,
    forwarding_country       NVARCHAR(100)    NULL,
    final_balance_amount     DECIMAL(12, 2)   NULL,
    inspection_notes         NVARCHAR(MAX)    NULL,
    internal_notes           NVARCHAR(MAX)    NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    created_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    updated_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION
  );
END;
GO

-- ---------------------------------------------------------------------------
-- lease_evictions
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.lease_evictions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.lease_evictions (
    lease_id                 UNIQUEIDENTIFIER NOT NULL PRIMARY KEY
                             REFERENCES leases (id) ON DELETE NO ACTION,
    case_number              NVARCHAR(200)    NULL,
    notice_served_on         DATE             NULL,
    judgment_date            DATE             NULL,
    judgment_amount          DECIMAL(12, 2)   NULL,
    collections_forwarded    BIT              NOT NULL DEFAULT 0,
    details                  NVARCHAR(MAX)    NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    created_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    updated_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION
  );
END;
GO

-- ---------------------------------------------------------------------------
-- lease_notices
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.lease_notices', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.lease_notices (
    id                       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    lease_id                 UNIQUEIDENTIFIER NOT NULL REFERENCES leases (id) ON DELETE NO ACTION,
    given_by_user_id         UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    given_on                 DATE             NOT NULL,
    planned_move_out_date    DATE             NOT NULL,
    reason                   NVARCHAR(30)     NULL
        CHECK (reason IS NULL OR reason IN ('relocating', 'job', 'purchase', 'early_termination', 'other')),
    reason_notes             NVARCHAR(1000)   NULL,
    scope                    NVARCHAR(15)     NOT NULL
        CHECK (scope IN ('all_tenants', 'self_only')),
    early_termination        BIT              NOT NULL DEFAULT 0,
    status                   NVARCHAR(25)     NOT NULL
        CHECK (status IN ('pending_co_signers', 'pending_landlord', 'pending_tenant',
                          'accepted', 'withdrawn', 'rejected', 'superseded')),
    counter_proposed_date    DATE             NULL,
    counter_proposed_notes   NVARCHAR(1000)   NULL,
    counter_proposed_at      DATETIMEOFFSET   NULL,
    counter_proposed_by      UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    responded_at             DATETIMEOFFSET   NULL,
    responded_by             UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    withdrawn_at             DATETIMEOFFSET   NULL,
    withdrawn_by             UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    landlord_notes           NVARCHAR(MAX)    NULL,
    forwarding_street        NVARCHAR(500)    NULL,
    forwarding_street2       NVARCHAR(500)    NULL,
    forwarding_city          NVARCHAR(200)    NULL,
    forwarding_state         NVARCHAR(100)    NULL,
    forwarding_zip           NVARCHAR(20)     NULL,
    forwarding_country       NVARCHAR(100)    NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO

-- Filtered index — SQL Server rejects NOT IN in a filtered predicate, so we spell out
-- each excluded status with <>.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_lease_notices_lease_status'
                 AND object_id = OBJECT_ID('dbo.lease_notices'))
BEGIN
  CREATE INDEX idx_lease_notices_lease_status
    ON dbo.lease_notices (lease_id, status)
    WHERE status <> 'withdrawn' AND status <> 'rejected' AND status <> 'superseded';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_lease_notices_planned_move_out'
                 AND object_id = OBJECT_ID('dbo.lease_notices'))
BEGIN
  CREATE INDEX idx_lease_notices_planned_move_out
    ON dbo.lease_notices (planned_move_out_date)
    WHERE status = 'accepted';
END;
GO

-- ---------------------------------------------------------------------------
-- lease_notice_co_signs
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.lease_notice_co_signs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.lease_notice_co_signs (
    id                       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    notice_id                UNIQUEIDENTIFIER NOT NULL REFERENCES lease_notices (id) ON DELETE CASCADE,
    tenant_user_id           UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    signed_at                DATETIMEOFFSET   NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_lease_notice_co_signs UNIQUE (notice_id, tenant_user_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_lease_notice_co_signs_unsigned'
                 AND object_id = OBJECT_ID('dbo.lease_notice_co_signs'))
BEGIN
  CREATE INDEX idx_lease_notice_co_signs_unsigned
    ON dbo.lease_notice_co_signs (notice_id, tenant_user_id)
    WHERE signed_at IS NULL;
END;
GO

-- ---------------------------------------------------------------------------
-- lease_deposits
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.lease_deposits', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.lease_deposits (
    id                       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    lease_id                 UNIQUEIDENTIFIER NOT NULL REFERENCES leases (id) ON DELETE NO ACTION,
    kind                     NVARCHAR(30)     NOT NULL DEFAULT 'SECURITY'
        CHECK (kind IN ('SECURITY', 'PET', 'KEY', 'LAST_MONTH', 'OTHER')),
    amount                   DECIMAL(12, 2)   NOT NULL CHECK (amount >= 0),
    held_since               DATE             NOT NULL,
    notes                    NVARCHAR(1000)   NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    created_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    updated_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    deleted_at               DATETIMEOFFSET   NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_lease_deposits_lease'
                 AND object_id = OBJECT_ID('dbo.lease_deposits'))
BEGIN
  CREATE INDEX idx_lease_deposits_lease
    ON dbo.lease_deposits (lease_id)
    WHERE deleted_at IS NULL;
END;
GO

-- ---------------------------------------------------------------------------
-- lease_deposit_dispositions
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.lease_deposit_dispositions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.lease_deposit_dispositions (
    id                       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    lease_deposit_id         UNIQUEIDENTIFIER NOT NULL REFERENCES lease_deposits (id) ON DELETE NO ACTION,
    refunded_amount          DECIMAL(12, 2)   NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
    withheld_amount          DECIMAL(12, 2)   NOT NULL DEFAULT 0 CHECK (withheld_amount >= 0),
    withholding_reason       NVARCHAR(MAX)    NULL,
    processed_on             DATE             NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    created_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    updated_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    CONSTRAINT uq_lease_deposit_dispositions UNIQUE (lease_deposit_id)
  );
END;
GO

-- ---------------------------------------------------------------------------
-- landlord_tenant_blocks
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.landlord_tenant_blocks', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.landlord_tenant_blocks (
    id                       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    landlord_user_id         UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    tenant_user_id           UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    source_lease_id          UNIQUEIDENTIFIER NULL REFERENCES leases (id) ON DELETE NO ACTION,
    reason                   NVARCHAR(30)     NOT NULL DEFAULT 'eviction'
        CHECK (reason IN ('eviction', 'manual')),
    notes                    NVARCHAR(1000)   NULL,
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    created_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    overridden_at            DATETIMEOFFSET   NULL,
    overridden_by            UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    override_notes           NVARCHAR(1000)   NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_landlord_tenant_blocks_active'
                 AND object_id = OBJECT_ID('dbo.landlord_tenant_blocks'))
BEGIN
  CREATE INDEX idx_landlord_tenant_blocks_active
    ON dbo.landlord_tenant_blocks (landlord_user_id, tenant_user_id)
    WHERE overridden_at IS NULL;
END;
GO

-- ---------------------------------------------------------------------------
-- tenant_portal_access
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.tenant_portal_access', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_portal_access (
    id                       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    tenant_user_id           UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    landlord_user_id         UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    source_lease_id          UNIQUEIDENTIFIER NULL REFERENCES leases (id) ON DELETE NO ACTION,
    access_level             NVARCHAR(15)     NOT NULL
        CHECK (access_level IN ('READ_ONLY', 'REVOKED')),
    effective_until          DATETIMEOFFSET   NULL,
    reason                   NVARCHAR(30)     NOT NULL
        CHECK (reason IN ('move_out', 'eviction', 'early_termination', 'manual')),
    created_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    created_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    updated_by               UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    CONSTRAINT uq_tenant_portal_access_pair UNIQUE (tenant_user_id, landlord_user_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_tenant_portal_access_effective_until'
                 AND object_id = OBJECT_ID('dbo.tenant_portal_access'))
BEGIN
  CREATE INDEX idx_tenant_portal_access_effective_until
    ON dbo.tenant_portal_access (effective_until)
    WHERE access_level = 'READ_ONLY' AND effective_until IS NOT NULL;
END;
GO
