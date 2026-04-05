-- Rename users identity column to external_auth_oid and normalize role constraint.
-- Idempotent: safe to re-run across mixed environments.

-- 1) Rename external_auth_subject -> external_auth_oid when needed.
IF COL_LENGTH('dbo.users', 'external_auth_oid') IS NULL
   AND COL_LENGTH('dbo.users', 'external_auth_subject') IS NOT NULL
BEGIN
  EXEC sp_rename 'dbo.users.external_auth_subject', 'external_auth_oid', 'COLUMN';
END

-- 2) Keep unique constraint name aligned with the renamed column.
IF EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.users')
    AND type = 'UQ'
    AND name = 'uq_users_external_auth_subject'
)
AND NOT EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.users')
    AND type = 'UQ'
    AND name = 'uq_users_external_auth_oid'
)
BEGIN
  EXEC sp_rename 'dbo.uq_users_external_auth_subject', 'uq_users_external_auth_oid', 'OBJECT';
END

IF COL_LENGTH('dbo.users', 'external_auth_oid') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM sys.key_constraints
     WHERE parent_object_id = OBJECT_ID('dbo.users')
       AND type = 'UQ'
       AND name = 'uq_users_external_auth_oid'
   )
BEGIN
  ALTER TABLE dbo.users
  ADD CONSTRAINT uq_users_external_auth_oid UNIQUE (external_auth_oid);
END

-- 3) Ensure users.role check allows ADMIN / LANDLORD / TENANT.
DECLARE @roleConstraintName NVARCHAR(200);
DECLARE @roleCheckDefinition NVARCHAR(MAX);

SELECT TOP 1
  @roleConstraintName = cc.name,
  @roleCheckDefinition = cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
  AND cc.definition LIKE '%\[role\]%' ESCAPE '\';

IF @roleConstraintName IS NULL
BEGIN
  ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT'));
END
ELSE IF @roleCheckDefinition NOT LIKE '%''LANDLORD''%'
        OR @roleCheckDefinition LIKE '%''VENDOR''%'
BEGIN
  DECLARE @dropRoleConstraintSql NVARCHAR(MAX);

  UPDATE dbo.users
  SET role = 'LANDLORD'
  WHERE role = 'VENDOR';

  SET @dropRoleConstraintSql =
    N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@roleConstraintName);
  EXEC sp_executesql @dropRoleConstraintSql;

  ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT'));
END
