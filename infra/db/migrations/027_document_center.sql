-- Document Center v1 schema (Azure SQL / T-SQL).
-- Adds paid-tier entitlement, document metadata, upload intents, share links,
-- consent records, audit events, and minimal operational controls.

IF COL_LENGTH('dbo.subscription_tiers', 'document_center_enabled') IS NULL
BEGIN
  ALTER TABLE dbo.subscription_tiers
    ADD document_center_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_document_center_enabled DEFAULT 0;
END;

IF COL_LENGTH('dbo.users', 'document_center_suspended_at') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD document_center_suspended_at DATETIMEOFFSET NULL,
        document_center_suspended_by UNIQUEIDENTIFIER NULL REFERENCES users (id),
        document_center_suspension_reason NVARCHAR(1000) NULL;
END;

-- New columns are not visible until the next batch (SQL Server ALTER + same-batch UPDATE rule).
GO

UPDATE dbo.subscription_tiers
SET document_center_enabled = 1
WHERE UPPER(name) IN ('STARTER', 'PRO');

IF OBJECT_ID('dbo.document_access_holds', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_access_holds (
    id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    lease_id          UNIQUEIDENTIFIER NOT NULL REFERENCES leases (id) ON DELETE CASCADE,
    extended_until    DATETIMEOFFSET   NOT NULL,
    reason            NVARCHAR(1000)   NOT NULL,
    created_by        UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    created_at        DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    revoked_at        DATETIMEOFFSET   NULL,
    revoked_by        UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION
  );

  CREATE INDEX idx_document_access_holds_lease
    ON dbo.document_access_holds (lease_id, extended_until DESC)
    WHERE revoked_at IS NULL;
END;

IF OBJECT_ID('dbo.document_upload_intents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_upload_intents (
    id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    landlord_id            UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    property_id            UNIQUEIDENTIFIER NOT NULL REFERENCES properties (id) ON DELETE NO ACTION,
    lease_id               UNIQUEIDENTIFIER NULL REFERENCES leases (id) ON DELETE NO ACTION,
    subject_tenant_user_id UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    scope_type             NVARCHAR(30)     NOT NULL CHECK (scope_type IN ('LEASE', 'PROPERTY', 'TENANT_ON_LEASE')),
    uploaded_by_user_id    UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    uploaded_by_role       NVARCHAR(20)     NOT NULL,
    storage_path           NVARCHAR(2000)   NOT NULL,
    -- Unique index key must stay within SQL Server's 1700-byte limit; hash the path instead.
    storage_path_sha256    AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', storage_path)) PERSISTED NOT NULL,
    original_filename      NVARCHAR(500)    NOT NULL,
    content_type           NVARCHAR(200)    NOT NULL,
    file_size_bytes        BIGINT           NOT NULL CHECK (file_size_bytes > 0),
    document_type          NVARCHAR(60)     NOT NULL,
    title                  NVARCHAR(300)    NULL,
    note                   NVARCHAR(1000)   NULL,
    share_with_tenants     BIT              NOT NULL DEFAULT 0,
    consent_acknowledged   BIT              NOT NULL DEFAULT 0,
    status                 NVARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                                        CHECK (status IN ('PENDING', 'FINALIZED', 'EXPIRED', 'CANCELLED')),
    expires_at             DATETIMEOFFSET   NOT NULL,
    finalized_document_id  UNIQUEIDENTIFIER NULL,
    created_at             DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    finalized_at           DATETIMEOFFSET   NULL
  );

  CREATE UNIQUE INDEX uq_document_upload_intents_storage_path_sha256
    ON dbo.document_upload_intents (storage_path_sha256);
  CREATE INDEX idx_document_upload_intents_expiry
    ON dbo.document_upload_intents (status, expires_at);
END;

IF OBJECT_ID('dbo.documents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.documents (
    id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    landlord_id            UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    property_id            UNIQUEIDENTIFIER NOT NULL REFERENCES properties (id) ON DELETE NO ACTION,
    lease_id               UNIQUEIDENTIFIER NULL REFERENCES leases (id) ON DELETE NO ACTION,
    subject_tenant_user_id UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    scope_type             NVARCHAR(30)     NOT NULL CHECK (scope_type IN ('LEASE', 'PROPERTY', 'TENANT_ON_LEASE')),
    uploaded_by_user_id    UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    uploaded_by_role       NVARCHAR(20)     NOT NULL,
    title                  NVARCHAR(300)    NULL,
    original_filename      NVARCHAR(500)    NOT NULL,
    document_type          NVARCHAR(60)     NOT NULL,
    note                   NVARCHAR(1000)   NULL,
    content_type           NVARCHAR(200)    NOT NULL,
    file_size_bytes        BIGINT           NOT NULL CHECK (file_size_bytes >= 0),
    storage_path           NVARCHAR(2000)   NOT NULL,
    storage_path_sha256    AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', storage_path)) PERSISTED NOT NULL,
    visibility             NVARCHAR(30)     NOT NULL DEFAULT 'LANDLORD_PRIVATE'
                                        CHECK (visibility IN ('LANDLORD_PRIVATE', 'SHARED_WITH_TENANTS')),
    scan_status            NVARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                                        CHECK (scan_status IN ('PENDING', 'CLEAN', 'BLOCKED', 'FAILED')),
    preview_status         NVARCHAR(20)     NOT NULL DEFAULT 'UNAVAILABLE'
                                        CHECK (preview_status IN ('AVAILABLE', 'DOWNLOAD_ONLY', 'UNAVAILABLE')),
    deleted_at             DATETIMEOFFSET   NULL,
    deleted_by             UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    restored_at            DATETIMEOFFSET   NULL,
    restored_by            UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    blob_deleted_at        DATETIMEOFFSET   NULL,
    purged_at              DATETIMEOFFSET   NULL,
    purged_by              UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    legal_hold_at          DATETIMEOFFSET   NULL,
    legal_hold_by          UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    legal_hold_reason      NVARCHAR(1000)   NULL,
    created_at             DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at             DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE UNIQUE INDEX uq_documents_storage_path_sha256
    ON dbo.documents (storage_path_sha256);
  CREATE INDEX idx_documents_landlord_created
    ON dbo.documents (landlord_id, created_at DESC)
    WHERE purged_at IS NULL;
  CREATE INDEX idx_documents_property_created
    ON dbo.documents (property_id, created_at DESC)
    WHERE purged_at IS NULL;
  CREATE INDEX idx_documents_lease_created
    ON dbo.documents (lease_id, created_at DESC)
    WHERE lease_id IS NOT NULL AND purged_at IS NULL;
END;

IF OBJECT_ID('dbo.document_visibility_grants', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_visibility_grants (
    id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    document_id            UNIQUEIDENTIFIER NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    lease_id               UNIQUEIDENTIFIER NOT NULL REFERENCES leases (id) ON DELETE NO ACTION,
    tenant_user_id         UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    grant_type             NVARCHAR(30)     NOT NULL CHECK (grant_type IN ('LEASE_HOUSEHOLD', 'TENANT')),
    created_by             UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    created_at             DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    revoked_at             DATETIMEOFFSET   NULL,
    revoked_by             UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    CONSTRAINT uq_document_visibility_grants UNIQUE (document_id, lease_id, tenant_user_id, grant_type)
  );

  CREATE INDEX idx_document_visibility_grants_tenant
    ON dbo.document_visibility_grants (tenant_user_id, lease_id)
    WHERE revoked_at IS NULL;
END;

IF OBJECT_ID('dbo.document_share_links', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_share_links (
    id                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    document_id            UNIQUEIDENTIFIER NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    token_hash             NVARCHAR(200)    NOT NULL,
    passcode_hash          NVARCHAR(200)    NULL,
    expires_at             DATETIMEOFFSET   NOT NULL,
    created_by_landlord_id UNIQUEIDENTIFIER NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    created_at             DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    revoked_at             DATETIMEOFFSET   NULL,
    revoked_by             UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE NO ACTION,
    last_accessed_at       DATETIMEOFFSET   NULL,
    access_count           INT              NOT NULL DEFAULT 0,
    failed_passcode_count  INT              NOT NULL DEFAULT 0
  );

  CREATE UNIQUE INDEX uq_document_share_links_token_hash
    ON dbo.document_share_links (token_hash);
  CREATE INDEX idx_document_share_links_document
    ON dbo.document_share_links (document_id, created_at DESC);
END;

IF OBJECT_ID('dbo.document_consent_records', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_consent_records (
    id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    -- NO ACTION avoids SQL Server "multiple cascade paths" (documents CASCADE → share_links
    -- plus SET NULL on this table from both document_id and share_link_id).
    document_id          UNIQUEIDENTIFIER NULL REFERENCES documents (id) ON DELETE NO ACTION,
    upload_intent_id     UNIQUEIDENTIFIER NULL REFERENCES document_upload_intents (id) ON DELETE NO ACTION,
    share_link_id        UNIQUEIDENTIFIER NULL REFERENCES document_share_links (id) ON DELETE NO ACTION,
    actor_user_id        UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE SET NULL,
    actor_role           NVARCHAR(20)     NULL,
    consent_type         NVARCHAR(50)     NOT NULL,
    notice_version       NVARCHAR(50)     NOT NULL,
    consent_text         NVARCHAR(2000)   NOT NULL,
    ip_address           NVARCHAR(100)    NULL,
    user_agent           NVARCHAR(500)    NULL,
    created_at           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_document_consent_records_document
    ON dbo.document_consent_records (document_id, created_at DESC);
END;

IF OBJECT_ID('dbo.document_audit_events', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_audit_events (
    id             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    document_id    UNIQUEIDENTIFIER NULL REFERENCES documents (id) ON DELETE SET NULL,
    actor_user_id  UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE SET NULL,
    actor_role     NVARCHAR(20)     NULL,
    event_type     NVARCHAR(80)     NOT NULL,
    before_json    NVARCHAR(MAX)    NULL,
    after_json     NVARCHAR(MAX)    NULL,
    ip_address     NVARCHAR(100)    NULL,
    user_agent     NVARCHAR(500)    NULL,
    created_at     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );

  CREATE INDEX idx_document_audit_events_document
    ON dbo.document_audit_events (document_id, created_at DESC);
  CREATE INDEX idx_document_audit_events_actor
    ON dbo.document_audit_events (actor_user_id, created_at DESC);
END;
