-- Consolidated AI_AGENT migration + seed.
-- This migration combines the previous role/agent routing setup and Elsa system user seed.
-- Idempotent: safe to re-run.

-- 1) Ensure users.role check allows ADMIN / LANDLORD / TENANT / AI_AGENT.
DECLARE @roleConstraintName NVARCHAR(200);
DECLARE @roleCheckDefinition NVARCHAR(MAX);

SELECT TOP 1
  @roleConstraintName = cc.name,
  @roleCheckDefinition = cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
  AND cc.definition LIKE '%[role]%';

IF @roleConstraintName IS NULL
BEGIN
  ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT', 'AI_AGENT'));
END
ELSE IF @roleCheckDefinition NOT LIKE '%''AI_AGENT''%'
BEGIN
  DECLARE @dropRoleConstraintSql NVARCHAR(MAX) =
    N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@roleConstraintName);
  EXEC sp_executesql @dropRoleConstraintSql;

  ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT', 'AI_AGENT'));
END;

-- 2) Ensure Elsa automated actions use a real users row for FK integrity.
-- Required by request_messages.sender_user_id and elsa_decisions.triggering_user_id.
DECLARE @elsaSystemUserId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000000';
DECLARE @elsaExternalAuthOid NVARCHAR(500) = 'system:elsa:auto-responder';
DECLARE @elsaEmail NVARCHAR(320) = 'elsa-system@carwoods.local';

IF EXISTS (SELECT 1 FROM dbo.users WHERE id = @elsaSystemUserId)
BEGIN
  UPDATE dbo.users
     SET external_auth_oid = CASE
           WHEN external_auth_oid IS NULL OR LTRIM(RTRIM(external_auth_oid)) = '' THEN @elsaExternalAuthOid
           ELSE external_auth_oid
         END,
         email = CASE
           WHEN email IS NULL OR LTRIM(RTRIM(email)) = '' THEN @elsaEmail
           ELSE email
         END,
         first_name = COALESCE(first_name, 'Elsa'),
         last_name = COALESCE(last_name, 'System'),
         role = 'AI_AGENT',
         status = 'ACTIVE',
         updated_at = SYSDATETIMEOFFSET()
   WHERE id = @elsaSystemUserId;
END
ELSE
BEGIN
  INSERT INTO dbo.users (
    id,
    external_auth_oid,
    email,
    first_name,
    last_name,
    role,
    status
  )
  VALUES (
    @elsaSystemUserId,
    @elsaExternalAuthOid,
    @elsaEmail,
    'Elsa',
    'System',
    'AI_AGENT',
    'ACTIVE'
  );
END;

-- 3) AI agents catalog.
IF OBJECT_ID('dbo.ai_agents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ai_agents (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL,
    display_name NVARCHAR(200) NOT NULL,
    provider NVARCHAR(50) NOT NULL,
    primary_model NVARCHAR(200) NOT NULL,
    fallback_model NVARCHAR(200) NULL,
    enabled BIT NOT NULL DEFAULT 1,
    is_system BIT NOT NULL DEFAULT 0,
    metadata_json NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    created_by_user_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    updated_by_user_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_ai_agents_code UNIQUE (code),
    CONSTRAINT ck_ai_agents_provider CHECK (provider IN ('GEMINI', 'OPENAI', 'AZURE_OPENAI', 'OTHER'))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.ai_agents')
    AND name = 'idx_ai_agents_enabled'
)
BEGIN
  CREATE INDEX idx_ai_agents_enabled ON dbo.ai_agents(enabled, code);
END;

-- 4) Global primary/fallback routing.
IF OBJECT_ID('dbo.ai_agent_routing', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ai_agent_routing (
    config_key NVARCHAR(50) NOT NULL PRIMARY KEY,
    primary_agent_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.ai_agents(id),
    fallback_agent_id UNIQUEIDENTIFIER NULL REFERENCES dbo.ai_agents(id),
    updated_by_user_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT ck_ai_agent_routing_key CHECK (config_key = 'default')
  );
END;

-- 5) Seed Elsa + Brian agents.
DECLARE @elsaAgentId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @brianAgentId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';

MERGE dbo.ai_agents AS target
USING (
  SELECT
    @elsaAgentId AS id,
    'elsa-primary' AS code,
    'Elsa' AS display_name,
    'GEMINI' AS provider,
    'gemini-2.5-flash' AS primary_model,
    NULL AS fallback_model,
    1 AS enabled,
    1 AS is_system,
    '{"persona":"elsa","role":"AI_AGENT"}' AS metadata_json,
    @elsaSystemUserId AS actor_user_id
  UNION ALL
  SELECT
    @brianAgentId AS id,
    'brian-fallback' AS code,
    'Brian' AS display_name,
    'GEMINI' AS provider,
    'gemini-2.5-flash-lite' AS primary_model,
    NULL AS fallback_model,
    1 AS enabled,
    1 AS is_system,
    '{"persona":"brian","role":"AI_AGENT"}' AS metadata_json,
    @elsaSystemUserId AS actor_user_id
) AS src
ON target.code = src.code
WHEN MATCHED THEN
  UPDATE SET
    display_name = src.display_name,
    provider = src.provider,
    primary_model = src.primary_model,
    fallback_model = src.fallback_model,
    enabled = src.enabled,
    is_system = src.is_system,
    metadata_json = src.metadata_json,
    updated_by_user_id = src.actor_user_id,
    updated_at = SYSDATETIMEOFFSET()
WHEN NOT MATCHED THEN
  INSERT (
    id, code, display_name, provider, primary_model, fallback_model, enabled, is_system,
    metadata_json, created_by_user_id, updated_by_user_id
  )
  VALUES (
    src.id, src.code, src.display_name, src.provider, src.primary_model, src.fallback_model,
    src.enabled, src.is_system, src.metadata_json, src.actor_user_id, src.actor_user_id
  );

IF NOT EXISTS (SELECT 1 FROM dbo.ai_agent_routing WHERE config_key = 'default')
BEGIN
  INSERT INTO dbo.ai_agent_routing (
    config_key, primary_agent_id, fallback_agent_id, updated_by_user_id
  )
  VALUES (
    'default', @elsaAgentId, @brianAgentId, @elsaSystemUserId
  );
END;
