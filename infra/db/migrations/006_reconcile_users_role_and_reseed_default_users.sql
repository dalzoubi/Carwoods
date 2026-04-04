-- Reconcile users.role taxonomy across environments and reseed default users.
-- This migration is required because 005 may already be marked as applied.

DECLARE @roleConstraintName NVARCHAR(200);
DECLARE @roleCheckDefinition NVARCHAR(MAX);

SELECT TOP 1
  @roleConstraintName = cc.name,
  @roleCheckDefinition = cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
  AND cc.definition LIKE '%role%';

-- If an older schema still allows VENDOR (and not LANDLORD), normalize to LANDLORD.
IF @roleCheckDefinition IS NOT NULL
   AND @roleCheckDefinition LIKE '%''VENDOR''%'
   AND @roleCheckDefinition NOT LIKE '%''LANDLORD''%'
BEGIN
  UPDATE dbo.users
  SET role = 'LANDLORD'
  WHERE role = 'VENDOR';

  EXEC(N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@roleConstraintName) + ';');

  ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT'));
END
ELSE IF @roleCheckDefinition IS NULL
BEGIN
  ALTER TABLE dbo.users
  ADD CONSTRAINT ck_users_role
  CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT'));
END

MERGE dbo.users AS target
USING (VALUES
  ('denisyz@gmail.com',   'LANDLORD', 'ACTIVE'),
  ('dennis@carwoods.com', 'ADMIN',    'ACTIVE'),
  ('dsaz1900@gmail.com',  'TENANT',   'ACTIVE')
) AS src (email, role, status)
  ON LOWER(target.email) = src.email
WHEN MATCHED THEN
  UPDATE SET
    email = src.email,
    role = src.role,
    status = src.status,
    external_auth_subject = CASE
      WHEN target.external_auth_subject IS NULL OR LTRIM(RTRIM(target.external_auth_subject)) = ''
        THEN CONCAT('seed:', src.email)
      ELSE target.external_auth_subject
    END,
    updated_at = SYSDATETIMEOFFSET()
WHEN NOT MATCHED THEN
  INSERT (
    id,
    external_auth_subject,
    email,
    first_name,
    last_name,
    role,
    status
  )
  VALUES (
    NEWID(),
    CONCAT('seed:', src.email),
    src.email,
    NULL,
    NULL,
    src.role,
    src.status
  );
