-- Carwoods tenant portal — initial schema (Azure SQL / T-SQL)
-- Apply with sqlcmd or Azure Data Studio against database carwoods_portal_prod.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id                   UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    external_auth_subject NVARCHAR(500)    NOT NULL,
    email                NVARCHAR(320)     NOT NULL,
    first_name           NVARCHAR(200)     NULL,
    last_name            NVARCHAR(200)     NULL,
    phone                NVARCHAR(50)      NULL,
    role                 NVARCHAR(20)      NOT NULL CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT')),
    status               NVARCHAR(20)      NOT NULL CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')),
    created_at           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_users_external_auth_subject UNIQUE (external_auth_subject)
);

CREATE INDEX idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

CREATE TABLE properties (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    name                NVARCHAR(500)     NULL,
    street              NVARCHAR(500)     NOT NULL,
    city                NVARCHAR(200)     NOT NULL,
    state               NVARCHAR(100)     NOT NULL,
    zip                 NVARCHAR(20)      NOT NULL,
    har_listing_id      NVARCHAR(200)     NULL,
    listing_source      NVARCHAR(50)      NOT NULL DEFAULT 'MANUAL'
                        CHECK (listing_source IN ('MANUAL', 'HAR_SYNC', 'OTHER')),
    apply_visible       BIT               NOT NULL DEFAULT 0,
    -- JSON stored as NVARCHAR(MAX); validated / parsed in the application layer
    metadata            NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    har_sync_status     NVARCHAR(100)     NULL,
    har_sync_error      NVARCHAR(MAX)     NULL,
    har_last_synced_at  DATETIMEOFFSET    NULL,
    created_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    deleted_at          DATETIMEOFFSET    NULL,
    created_by          UNIQUEIDENTIFIER  NULL REFERENCES users (id),
    updated_by          UNIQUEIDENTIFIER  NULL REFERENCES users (id)
);

CREATE INDEX idx_properties_har_listing_id ON properties (har_listing_id)
    WHERE har_listing_id IS NOT NULL;
CREATE INDEX idx_properties_apply_visible ON properties (apply_visible, deleted_at)
    WHERE apply_visible = 1 AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- leases
-- ---------------------------------------------------------------------------

CREATE TABLE leases (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    property_id     UNIQUEIDENTIFIER  NOT NULL REFERENCES properties (id) ON DELETE NO ACTION,
    start_date      DATE              NOT NULL,
    end_date        DATE              NULL,
    month_to_month  BIT               NOT NULL DEFAULT 0,
    status          NVARCHAR(20)      NOT NULL
                    CHECK (status IN ('ACTIVE', 'ENDED', 'UPCOMING', 'TERMINATED')),
    notes           NVARCHAR(MAX)     NULL,
    created_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    deleted_at      DATETIMEOFFSET    NULL,
    created_by      UNIQUEIDENTIFIER  NULL REFERENCES users (id),
    updated_by      UNIQUEIDENTIFIER  NULL REFERENCES users (id)
);

CREATE INDEX idx_leases_property_id ON leases (property_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_active_property ON leases (property_id, status)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- lease_tenants
-- ---------------------------------------------------------------------------

CREATE TABLE lease_tenants (
    id               UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    lease_id         UNIQUEIDENTIFIER  NOT NULL REFERENCES leases (id) ON DELETE CASCADE,
    user_id          UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_start_at  DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    access_end_at    DATETIMEOFFSET    NULL,
    created_at       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_lease_tenants UNIQUE (lease_id, user_id)
);

CREATE INDEX idx_lease_tenants_user_id ON lease_tenants (user_id);

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------

CREATE TABLE vendors (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    user_id        UNIQUEIDENTIFIER  NULL REFERENCES users (id),
    company_name   NVARCHAR(500)     NOT NULL,
    contact_name   NVARCHAR(200)     NULL,
    email          NVARCHAR(320)     NULL,
    phone          NVARCHAR(50)      NULL,
    trade_category NVARCHAR(200)     NULL,
    notes          NVARCHAR(MAX)     NULL,
    active         BIT               NOT NULL DEFAULT 1,
    created_at     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    deleted_at     DATETIMEOFFSET    NULL
);

-- ---------------------------------------------------------------------------
-- service_categories
-- ---------------------------------------------------------------------------

CREATE TABLE service_categories (
    id          UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    code        NVARCHAR(100)     NOT NULL,
    name        NVARCHAR(200)     NOT NULL,
    description NVARCHAR(MAX)     NULL,
    active      BIT               NOT NULL DEFAULT 1,
    sort_order  INT               NOT NULL DEFAULT 0,
    CONSTRAINT uq_service_categories_code UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- request_priorities
-- ---------------------------------------------------------------------------

CREATE TABLE request_priorities (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    code       NVARCHAR(100)     NOT NULL,
    name       NVARCHAR(200)     NOT NULL,
    sort_order INT               NOT NULL DEFAULT 0,
    active     BIT               NOT NULL DEFAULT 1,
    CONSTRAINT uq_request_priorities_code UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- request_statuses
-- ---------------------------------------------------------------------------

CREATE TABLE request_statuses (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    code           NVARCHAR(100)     NOT NULL,
    name           NVARCHAR(200)     NOT NULL,
    sort_order     INT               NOT NULL DEFAULT 0,
    system_default BIT               NOT NULL DEFAULT 0,
    active         BIT               NOT NULL DEFAULT 1,
    CONSTRAINT uq_request_statuses_code UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- maintenance_requests
-- ---------------------------------------------------------------------------

CREATE TABLE maintenance_requests (
    id                                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    property_id                         UNIQUEIDENTIFIER  NOT NULL REFERENCES properties (id) ON DELETE NO ACTION,
    lease_id                            UNIQUEIDENTIFIER  NOT NULL REFERENCES leases (id) ON DELETE NO ACTION,
    submitted_by_user_id                UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    assigned_vendor_id                  UNIQUEIDENTIFIER  NULL REFERENCES vendors (id),
    category_id                         UNIQUEIDENTIFIER  NOT NULL REFERENCES service_categories (id),
    priority_id                         UNIQUEIDENTIFIER  NOT NULL REFERENCES request_priorities (id),
    current_status_id                   UNIQUEIDENTIFIER  NOT NULL REFERENCES request_statuses (id),
    title                               NVARCHAR(500)     NOT NULL,
    description                         NVARCHAR(MAX)     NOT NULL,
    internal_notes                      NVARCHAR(MAX)     NULL,
    estimated_cost                      DECIMAL(12, 2)    NULL,
    actual_cost                         DECIMAL(12, 2)    NULL,
    scheduled_for                       DATETIMEOFFSET    NULL,
    vendor_contact_name                 NVARCHAR(200)     NULL,
    vendor_contact_email                NVARCHAR(320)     NULL,
    vendor_contact_phone                NVARCHAR(50)      NULL,
    emergency_disclaimer_acknowledged   BIT               NOT NULL DEFAULT 0,
    created_at                          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at                          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    completed_at                        DATETIMEOFFSET    NULL,
    closed_at                           DATETIMEOFFSET    NULL,
    deleted_at                          DATETIMEOFFSET    NULL
);

CREATE INDEX idx_requests_property_status_created
    ON maintenance_requests (property_id, current_status_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_submitted_by
    ON maintenance_requests (submitted_by_user_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_updated
    ON maintenance_requests (updated_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- request_status_history
-- ---------------------------------------------------------------------------

CREATE TABLE request_status_history (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    request_id          UNIQUEIDENTIFIER  NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    from_status_id      UNIQUEIDENTIFIER  NULL REFERENCES request_statuses (id),
    to_status_id        UNIQUEIDENTIFIER  NOT NULL REFERENCES request_statuses (id),
    changed_by_user_id  UNIQUEIDENTIFIER  NULL REFERENCES users (id),
    note                NVARCHAR(MAX)     NULL,
    created_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_request_status_history_request
    ON request_status_history (request_id, created_at);

-- ---------------------------------------------------------------------------
-- request_attachments
-- ---------------------------------------------------------------------------

CREATE TABLE request_attachments (
    id                    UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    request_id            UNIQUEIDENTIFIER  NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    uploaded_by_user_id   UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    storage_path          NVARCHAR(2000)    NOT NULL,
    original_filename     NVARCHAR(500)     NOT NULL,
    content_type          NVARCHAR(200)     NOT NULL,
    file_size_bytes       BIGINT            NOT NULL CHECK (file_size_bytes >= 0),
    media_type            NVARCHAR(20)      NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'FILE')),
    created_at            DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_request_attachments_request ON request_attachments (request_id);

-- ---------------------------------------------------------------------------
-- request_messages
-- ---------------------------------------------------------------------------

CREATE TABLE request_messages (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    request_id     UNIQUEIDENTIFIER  NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    sender_user_id UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    body           NVARCHAR(MAX)     NOT NULL,
    is_internal    BIT               NOT NULL DEFAULT 0,
    source         NVARCHAR(30)      NOT NULL DEFAULT 'PORTAL'
                   CHECK (source IN ('PORTAL', 'EMAIL', 'SYSTEM', 'AI_SUGGESTED')),
    created_at     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_request_messages_request
    ON request_messages (request_id, created_at);

-- ---------------------------------------------------------------------------
-- message_attachments
-- ---------------------------------------------------------------------------

CREATE TABLE message_attachments (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    message_id          UNIQUEIDENTIFIER  NOT NULL REFERENCES request_messages (id) ON DELETE CASCADE,
    uploaded_by_user_id UNIQUEIDENTIFIER  NOT NULL REFERENCES users (id) ON DELETE NO ACTION,
    storage_path        NVARCHAR(2000)    NOT NULL,
    original_filename   NVARCHAR(500)     NOT NULL,
    content_type        NVARCHAR(200)     NOT NULL,
    file_size_bytes     BIGINT            NOT NULL CHECK (file_size_bytes >= 0),
    created_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_message_attachments_message ON message_attachments (message_id);

-- ---------------------------------------------------------------------------
-- canned_responses
-- ---------------------------------------------------------------------------

CREATE TABLE canned_responses (
    id         UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    title      NVARCHAR(500)     NOT NULL,
    body       NVARCHAR(MAX)     NOT NULL,
    active     BIT               NOT NULL DEFAULT 1,
    sort_order INT               NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- notification_event_types
-- ---------------------------------------------------------------------------

CREATE TABLE notification_event_types (
    id     UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    code   NVARCHAR(100)     NOT NULL,
    name   NVARCHAR(200)     NOT NULL,
    active BIT               NOT NULL DEFAULT 1,
    CONSTRAINT uq_notification_event_types_code UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- notification_rules
-- ---------------------------------------------------------------------------

CREATE TABLE notification_rules (
    id                    UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    event_type_id         UNIQUEIDENTIFIER  NOT NULL REFERENCES notification_event_types (id) ON DELETE CASCADE,
    enabled               BIT               NOT NULL DEFAULT 1,
    notify_tenant         BIT               NOT NULL DEFAULT 0,
    notify_admin          BIT               NOT NULL DEFAULT 0,
    notify_vendor         BIT               NOT NULL DEFAULT 0,
    additional_recipients NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
    created_at            DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at            DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- ---------------------------------------------------------------------------
-- notification_outbox
-- ---------------------------------------------------------------------------

CREATE TABLE notification_outbox (
    id               UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    event_type_code  NVARCHAR(100)     NOT NULL,
    payload          NVARCHAR(MAX)     NOT NULL,
    idempotency_key  NVARCHAR(500)     NOT NULL,
    status           NVARCHAR(20)      NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts         INT               NOT NULL DEFAULT 0,
    last_error       NVARCHAR(MAX)     NULL,
    created_at       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    processed_at     DATETIMEOFFSET    NULL,
    CONSTRAINT uq_notification_outbox_idempotency UNIQUE (idempotency_key)
);

-- ---------------------------------------------------------------------------
-- notification_deliveries
-- ---------------------------------------------------------------------------

CREATE TABLE notification_deliveries (
    id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    outbox_id           UNIQUEIDENTIFIER  NULL REFERENCES notification_outbox (id) ON DELETE SET NULL,
    recipient_email     NVARCHAR(320)     NOT NULL,
    template_id         NVARCHAR(200)     NULL,
    status              NVARCHAR(20)      NOT NULL
                        CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
    provider_message_id NVARCHAR(500)     NULL,
    error               NVARCHAR(MAX)     NULL,
    created_at          DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_notification_deliveries_outbox ON notification_deliveries (outbox_id);

-- ---------------------------------------------------------------------------
-- property_listing_sync_jobs
-- ---------------------------------------------------------------------------

CREATE TABLE property_listing_sync_jobs (
    id             UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    property_id    UNIQUEIDENTIFIER  NULL REFERENCES properties (id) ON DELETE SET NULL,
    source         NVARCHAR(100)     NOT NULL,
    status         NVARCHAR(100)     NOT NULL,
    started_at     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    completed_at   DATETIMEOFFSET    NULL,
    result_summary NVARCHAR(MAX)     NULL,
    error_message  NVARCHAR(MAX)     NULL
);

CREATE INDEX idx_listing_sync_jobs_property
    ON property_listing_sync_jobs (property_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
    id           UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    actor_user_id UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE SET NULL,
    entity_type  NVARCHAR(100)     NOT NULL,
    entity_id    UNIQUEIDENTIFIER  NOT NULL,
    action       NVARCHAR(100)     NOT NULL,
    before_json  NVARCHAR(MAX)     NULL,
    after_json   NVARCHAR(MAX)     NULL,
    created_at   DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- ai_suggestion_log
-- ---------------------------------------------------------------------------

CREATE TABLE ai_suggestion_log (
    id                      UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    request_id              UNIQUEIDENTIFIER  NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    actor_user_id           UNIQUEIDENTIFIER  NULL REFERENCES users (id) ON DELETE SET NULL,
    model                   NVARCHAR(200)     NOT NULL,
    prompt_template_version NVARCHAR(100)     NOT NULL,
    latency_ms              INT               NULL,
    input_token_count       INT               NULL,
    output_token_count      INT               NULL,
    created_at              DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE INDEX idx_ai_suggestion_request
    ON ai_suggestion_log (request_id, created_at DESC);
