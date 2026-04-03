-- Carwoods tenant portal — initial schema
-- Apply with your migration runner or psql against Azure PostgreSQL.
-- Extensions commonly enabled on Azure: pgcrypto for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations (Postgres CHECK or VARCHAR + lookup tables; using VARCHAR + lookups where specified)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_auth_subject TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TENANT', 'VENDOR')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (lower(email));

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    har_listing_id TEXT,
    listing_source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (listing_source IN ('MANUAL', 'HAR_SYNC', 'OTHER')),
    apply_visible BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    har_sync_status TEXT,
    har_sync_error TEXT,
    har_last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users (id),
    updated_by UUID REFERENCES users (id)
);

CREATE INDEX idx_properties_har_listing_id ON properties (har_listing_id) WHERE har_listing_id IS NOT NULL;
CREATE INDEX idx_properties_apply_visible ON properties (apply_visible) WHERE apply_visible = true AND deleted_at IS NULL;

CREATE TABLE leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties (id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    month_to_month BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ENDED', 'UPCOMING', 'TERMINATED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users (id),
    updated_by UUID REFERENCES users (id)
);

CREATE INDEX idx_leases_property_id ON leases (property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leases_active_property ON leases (property_id) WHERE status = 'ACTIVE' AND deleted_at IS NULL;

CREATE TABLE lease_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES leases (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    access_end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (lease_id, user_id)
);

CREATE INDEX idx_lease_tenants_user_id ON lease_tenants (user_id);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users (id),
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    trade_category TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE request_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE request_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    system_default BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties (id) ON DELETE RESTRICT,
    lease_id UUID NOT NULL REFERENCES leases (id) ON DELETE RESTRICT,
    submitted_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    assigned_vendor_id UUID REFERENCES vendors (id),
    category_id UUID NOT NULL REFERENCES service_categories (id),
    priority_id UUID NOT NULL REFERENCES request_priorities (id),
    current_status_id UUID NOT NULL REFERENCES request_statuses (id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    internal_notes TEXT,
    estimated_cost NUMERIC(12, 2),
    actual_cost NUMERIC(12, 2),
    scheduled_for TIMESTAMPTZ,
    vendor_contact_name TEXT,
    vendor_contact_email TEXT,
    vendor_contact_phone TEXT,
    emergency_disclaimer_acknowledged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_requests_property_status_created ON maintenance_requests (property_id, current_status_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_submitted_by ON maintenance_requests (submitted_by_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_updated ON maintenance_requests (updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    from_status_id UUID REFERENCES request_statuses (id),
    to_status_id UUID NOT NULL REFERENCES request_statuses (id),
    changed_by_user_id UUID REFERENCES users (id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_status_history_request ON request_status_history (request_id, created_at);

CREATE TABLE request_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    media_type TEXT NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'FILE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_attachments_request ON request_attachments (request_id);

CREATE TABLE request_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    source TEXT NOT NULL DEFAULT 'PORTAL' CHECK (source IN ('PORTAL', 'EMAIL', 'SYSTEM', 'AI_SUGGESTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_messages_request ON request_messages (request_id, created_at);

CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES request_messages (id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_attachments_message ON message_attachments (message_id);

CREATE TABLE canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE notification_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type_id UUID NOT NULL REFERENCES notification_event_types (id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    notify_tenant BOOLEAN NOT NULL DEFAULT false,
    notify_admin BOOLEAN NOT NULL DEFAULT false,
    notify_vendor BOOLEAN NOT NULL DEFAULT false,
    additional_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type_code TEXT NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    UNIQUE (idempotency_key)
);

CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id UUID REFERENCES notification_outbox (id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    template_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
    provider_message_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_deliveries_outbox ON notification_deliveries (outbox_id);

CREATE TABLE property_listing_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties (id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    result_summary TEXT,
    error_message TEXT
);

CREATE INDEX idx_listing_sync_jobs_property ON property_listing_sync_jobs (property_id, started_at DESC);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id, created_at DESC);

CREATE TABLE ai_suggestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    prompt_template_version TEXT NOT NULL,
    latency_ms INT,
    input_token_count INT,
    output_token_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_suggestion_request ON ai_suggestion_log (request_id, created_at DESC);
