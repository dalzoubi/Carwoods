-- Seed default portal users by email with fixed roles.
-- Idempotent: updates existing rows and inserts missing rows.
-- Handles legacy schemas that still enforce VENDOR instead of LANDLORD.

DECLARE @roleCheckDefinition NVARCHAR(MAX);
DECLARE @landlordRole NVARCHAR(20) = 'LANDLORD';

SELECT TOP 1
  @roleCheckDefinition = cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
  AND cc.definition LIKE '%role%';

IF @roleCheckDefinition IS NOT NULL
   AND @roleCheckDefinition NOT LIKE '%''LANDLORD''%'
   AND @roleCheckDefinition LIKE '%''VENDOR''%'
BEGIN
  SET @landlordRole = 'VENDOR';
END

MERGE dbo.users AS target
USING (VALUES
  ('dennis@carwoods.com', 'ADMIN',    'ACTIVE'),
  ('denisyz@gmail.com',   @landlordRole, 'ACTIVE'),
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
