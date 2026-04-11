-- Consolidated AI_AGENT migration + seed.
-- This migration combines the previous role/agent routing setup and Elsa system user seed.
-- Idempotent: safe to re-run.

-- 1) Ensure users.role check allows ADMIN / LANDLORD / TENANT / AI_AGENT.
-- Some environments carry auto-generated role-check names; drop any prior role checks
-- by definition, then recreate a deterministic constraint.
DECLARE @roleConstraintName NVARCHAR(200);

DECLARE role_constraint_cursor CURSOR FAST_FORWARD FOR
SELECT cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
  AND cc.definition LIKE '%''ADMIN''%'
  AND cc.definition LIKE '%''TENANT''%'
  AND cc.definition NOT LIKE '%''ACTIVE''%';

OPEN role_constraint_cursor;
FETCH NEXT FROM role_constraint_cursor INTO @roleConstraintName;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @dropRoleConstraintSql NVARCHAR(MAX) =
    N'ALTER TABLE dbo.users DROP CONSTRAINT [' + REPLACE(@roleConstraintName, N']', N']]') + N']';
  EXEC sp_executesql @dropRoleConstraintSql;
  FETCH NEXT FROM role_constraint_cursor INTO @roleConstraintName;
END
CLOSE role_constraint_cursor;
DEALLOCATE role_constraint_cursor;

ALTER TABLE dbo.users
ADD CONSTRAINT ck_users_role
CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT', 'AI_AGENT'));

-- 2) Ensure Elsa automated actions use a real users row for FK integrity.
-- Required by request_messages.sender_user_id and elsa_decisions.triggering_user_id.
DECLARE @elsaSystemUserId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000000';
DECLARE @elsaExternalAuthOid NVARCHAR(500) = 'system:elsa:auto-responder';
DECLARE @elsaEmail NVARCHAR(320) = 'elsa-system@carwoods.local';
DECLARE @existingElsaUserId UNIQUEIDENTIFIER;

SELECT TOP 1 @existingElsaUserId = id
FROM dbo.users
WHERE id = @elsaSystemUserId
   OR external_auth_oid = @elsaExternalAuthOid
   OR email = @elsaEmail;

IF @existingElsaUserId IS NOT NULL
BEGIN
  SET @elsaSystemUserId = @existingElsaUserId;

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
   WHERE id = @existingElsaUserId;
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
DECLARE @elsaPrimaryAgentResolvedId UNIQUEIDENTIFIER;
DECLARE @brianFallbackAgentResolvedId UNIQUEIDENTIFIER;

SELECT @elsaPrimaryAgentResolvedId = id
FROM dbo.ai_agents
WHERE code = 'elsa-primary';

IF @elsaPrimaryAgentResolvedId IS NULL
BEGIN
  INSERT INTO dbo.ai_agents (
    id, code, display_name, provider, primary_model, fallback_model, enabled, is_system,
    metadata_json, created_by_user_id, updated_by_user_id
  )
  VALUES (
    @elsaAgentId, 'elsa-primary', 'Elsa', 'GEMINI', 'gemini-2.5-flash', NULL,
    1, 1, '{"persona":"elsa","role":"AI_AGENT"}', NULL, NULL
  );
END
ELSE
BEGIN
  UPDATE dbo.ai_agents
     SET display_name = 'Elsa',
         provider = 'GEMINI',
         primary_model = 'gemini-2.5-flash',
         fallback_model = NULL,
         enabled = 1,
         is_system = 1,
         metadata_json = '{"persona":"elsa","role":"AI_AGENT"}',
         updated_by_user_id = NULL,
         updated_at = SYSDATETIMEOFFSET()
   WHERE id = @elsaPrimaryAgentResolvedId;
END;

SELECT @elsaPrimaryAgentResolvedId = id
FROM dbo.ai_agents
WHERE code = 'elsa-primary';

SELECT @brianFallbackAgentResolvedId = id
FROM dbo.ai_agents
WHERE code = 'brian-fallback';

IF @brianFallbackAgentResolvedId IS NULL
BEGIN
  INSERT INTO dbo.ai_agents (
    id, code, display_name, provider, primary_model, fallback_model, enabled, is_system,
    metadata_json, created_by_user_id, updated_by_user_id
  )
  VALUES (
    @brianAgentId, 'brian-fallback', 'Brian', 'GEMINI', 'gemini-2.5-flash-lite', NULL,
    1, 1, '{"persona":"brian","role":"AI_AGENT"}', NULL, NULL
  );
END
ELSE
BEGIN
  UPDATE dbo.ai_agents
     SET display_name = 'Brian',
         provider = 'GEMINI',
         primary_model = 'gemini-2.5-flash-lite',
         fallback_model = NULL,
         enabled = 1,
         is_system = 1,
         metadata_json = '{"persona":"brian","role":"AI_AGENT"}',
         updated_by_user_id = NULL,
         updated_at = SYSDATETIMEOFFSET()
   WHERE id = @brianFallbackAgentResolvedId;
END;

SELECT @brianFallbackAgentResolvedId = id
FROM dbo.ai_agents
WHERE code = 'brian-fallback';

IF @elsaPrimaryAgentResolvedId IS NOT NULL
   AND @brianFallbackAgentResolvedId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.ai_agent_routing WHERE config_key = 'default')
  BEGIN
    INSERT INTO dbo.ai_agent_routing (
      config_key, primary_agent_id, fallback_agent_id, updated_by_user_id
    )
    VALUES (
      'default', @elsaPrimaryAgentResolvedId, @brianFallbackAgentResolvedId, NULL
    );
  END
  ELSE
  BEGIN
    UPDATE dbo.ai_agent_routing
       SET primary_agent_id = @elsaPrimaryAgentResolvedId,
           fallback_agent_id = @brianFallbackAgentResolvedId,
           updated_by_user_id = NULL,
           updated_at = SYSDATETIMEOFFSET()
     WHERE config_key = 'default';
  END;
END;
