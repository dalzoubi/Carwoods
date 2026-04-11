-- Align role taxonomy to ADMIN / LANDLORD / TENANT.
-- Existing VENDOR role values (if present) are migrated to LANDLORD.

UPDATE users
SET role = 'LANDLORD'
WHERE role = 'VENDOR';

DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('users')
  AND cc.definition LIKE '%[role]%';

IF @constraintName IS NOT NULL
BEGIN
  DECLARE @dropSql NVARCHAR(400);
  SET @dropSql = N'ALTER TABLE users DROP CONSTRAINT [' + REPLACE(@constraintName, N']', N']]') + N'];';
  EXEC sp_executesql @dropSql;
END

-- Recreate a deterministic role check constraint name.
ALTER TABLE users
ADD CONSTRAINT ck_users_role
CHECK (role IN ('ADMIN', 'LANDLORD', 'TENANT'));

