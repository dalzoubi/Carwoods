-- Elsa guardrailed auto-response foundation schema.
-- Conservative defaults: auto-send disabled until explicitly enabled.

IF OBJECT_ID('elsa_settings', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_settings (
    setting_key      NVARCHAR(200)   NOT NULL PRIMARY KEY,
    setting_value    NVARCHAR(MAX)   NOT NULL,
    updated_by_user_id UNIQUEIDENTIFIER NULL REFERENCES users (id),
    updated_at       DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF OBJECT_ID('elsa_property_policies', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_property_policies (
    property_id                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY REFERENCES properties (id) ON DELETE CASCADE,
    auto_send_enabled_override BIT              NULL,
    require_review_all         BIT              NOT NULL DEFAULT 0,
    updated_by_user_id         UNIQUEIDENTIFIER NULL REFERENCES users (id),
    updated_at                 DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF OBJECT_ID('elsa_category_policies', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_category_policies (
    category_code      NVARCHAR(100)    NOT NULL PRIMARY KEY,
    auto_send_enabled  BIT              NOT NULL DEFAULT 1,
    updated_by_user_id UNIQUEIDENTIFIER NULL REFERENCES users (id),
    updated_at         DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF OBJECT_ID('elsa_priority_policies', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_priority_policies (
    priority_code        NVARCHAR(100)    NOT NULL PRIMARY KEY,
    auto_send_enabled    BIT              NOT NULL DEFAULT 1,
    require_admin_review BIT              NOT NULL DEFAULT 0,
    updated_by_user_id   UNIQUEIDENTIFIER NULL REFERENCES users (id),
    updated_at           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF OBJECT_ID('elsa_request_policies', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_request_policies (
    request_id                  UNIQUEIDENTIFIER NOT NULL PRIMARY KEY REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    auto_respond_enabled        BIT              NOT NULL DEFAULT 0,
    updated_by_user_id          UNIQUEIDENTIFIER NULL REFERENCES users (id),
    updated_at                  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF OBJECT_ID('elsa_troubleshooting_allowlist', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_troubleshooting_allowlist (
    code            NVARCHAR(120)   NOT NULL PRIMARY KEY,
    category_code   NVARCHAR(100)   NULL,
    description     NVARCHAR(500)   NOT NULL,
    active          BIT             NOT NULL DEFAULT 1,
    created_at      DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF OBJECT_ID('elsa_decisions', 'U') IS NULL
BEGIN
  CREATE TABLE elsa_decisions (
    id                        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    request_id                UNIQUEIDENTIFIER NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    triggering_event          NVARCHAR(120)    NOT NULL,
    triggering_user_id        UNIQUEIDENTIFIER NULL REFERENCES users (id),
    model_name                NVARCHAR(200)    NULL,
    provider_used             NVARCHAR(40)     NULL,
    prompt_version            NVARCHAR(100)    NULL,
    mode                      NVARCHAR(60)     NULL,
    delivery_decision         NVARCHAR(60)     NULL,
    policy_decision           NVARCHAR(60)     NOT NULL,
    confidence                DECIMAL(4,3)     NULL,
    suggestion_json           NVARCHAR(MAX)    NULL,
    normalized_tenant_reply   NVARCHAR(MAX)    NULL,
    internal_summary          NVARCHAR(MAX)    NULL,
    recommended_next_action   NVARCHAR(MAX)    NULL,
    dispatch_summary          NVARCHAR(MAX)    NULL,
    policy_flags_json         NVARCHAR(MAX)    NULL,
    auto_send_rationale       NVARCHAR(MAX)    NULL,
    -- Keep default NO ACTION to avoid multiple cascade paths from maintenance_requests.
    sent_message_id           UNIQUEIDENTIFIER NULL REFERENCES request_messages (id),
    sent_at                   DATETIMEOFFSET   NULL,
    created_at                DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF COL_LENGTH('elsa_decisions', 'provider_used') IS NULL
BEGIN
  ALTER TABLE elsa_decisions
    ADD provider_used NVARCHAR(40) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_elsa_decisions_request_created')
BEGIN
  CREATE INDEX idx_elsa_decisions_request_created
      ON elsa_decisions (request_id, created_at DESC);
END;

-- Global settings defaults (conservative)
MERGE elsa_settings AS target
USING (VALUES
  ('elsa_enabled', 'true'),
  ('elsa_auto_send_enabled', 'false'),
  ('elsa_auto_send_confidence_threshold', '0.78'),
  ('elsa_allowed_categories', '["plumbing","hvac","electrical","appliances","general"]'),
  ('elsa_allowed_priorities', '["routine","urgent"]'),
  ('elsa_blocked_keywords', '["injury","lawsuit","attorney","reimbursement","liability","claim"]'),
  ('elsa_emergency_keywords', '["gas smell","smoke","fire","burning smell","sparking","exposed wires","flooding","sewage","carbon monoxide"]'),
  ('elsa_max_questions', '5'),
  ('elsa_max_steps', '5'),
  ('elsa_admin_alert_recipients', '[]'),
  ('elsa_emergency_template_enabled', 'true')
) AS src (setting_key, setting_value)
  ON target.setting_key = src.setting_key
WHEN NOT MATCHED THEN
  INSERT (setting_key, setting_value)
  VALUES (src.setting_key, src.setting_value);

MERGE elsa_category_policies AS target
USING (
  SELECT code FROM service_categories
) AS src (category_code)
ON target.category_code = src.category_code
WHEN NOT MATCHED THEN
  INSERT (category_code, auto_send_enabled)
  VALUES (src.category_code, 1);

MERGE elsa_priority_policies AS target
USING (
  SELECT code FROM request_priorities
) AS src (priority_code)
ON target.priority_code = src.priority_code
WHEN NOT MATCHED THEN
  INSERT (priority_code, auto_send_enabled, require_admin_review)
  VALUES (
    src.priority_code,
    CASE WHEN LOWER(src.priority_code) = 'emergency' THEN 0 ELSE 1 END,
    CASE WHEN LOWER(src.priority_code) = 'emergency' THEN 1 ELSE 0 END
  );

MERGE elsa_troubleshooting_allowlist AS target
USING (VALUES
  ('HVAC_CHECK_THERMOSTAT_MODE', 'hvac', 'Confirm thermostat is set to cool/heat as needed'),
  ('HVAC_CHECK_SETPOINT', 'hvac', 'Confirm thermostat setpoint is practical for current weather'),
  ('HVAC_CHECK_FILTER_VISIBLE', 'hvac', 'Confirm filter condition if tenant-accessible'),
  ('HVAC_CONFIRM_BLOWING_AIR', 'hvac', 'Confirm whether vents are blowing air'),
  ('ELECTRICAL_CHECK_GFCI_RESET', 'electrical', 'Check nearby GFCI outlet reset'),
  ('ELECTRICAL_CHECK_BREAKER_STATUS_BASIC', 'electrical', 'Confirm breaker status only at occupant level'),
  ('ELECTRICAL_CHECK_SWITCH_CONTROLLED_OUTLET', 'electrical', 'Confirm wall switch controls the outlet'),
  ('APPLIANCE_CONFIRM_POWER', 'appliances', 'Confirm appliance is plugged in and powered'),
  ('APPLIANCE_REQUEST_ERROR_CODE', 'appliances', 'Ask tenant for appliance error code'),
  ('PLUMBING_CONFIRM_LEAK_SOURCE', 'plumbing', 'Ask where leak appears to originate'),
  ('PLUMBING_SAFE_FIXTURE_SHUTOFF', 'plumbing', 'Request simple fixture-level shutoff if obvious and safe'),
  ('GENERAL_REQUEST_PHOTO', 'general', 'Ask tenant to provide a photo'),
  ('GENERAL_REQUEST_VIDEO', 'general', 'Ask tenant to provide a video'),
  ('GENERAL_REQUEST_LOCATION', 'general', 'Ask exact location of issue'),
  ('GENERAL_REQUEST_WHEN_STARTED', 'general', 'Ask when issue started'),
  ('GENERAL_REQUEST_SCOPE', 'general', 'Ask if issue affects one room/fixture or multiple')
) AS src (code, category_code, description)
ON target.code = src.code
WHEN NOT MATCHED THEN
  INSERT (code, category_code, description, active)
  VALUES (src.code, src.category_code, src.description, 1);
