-- Enforce one user row per email.
-- Idempotent: safe to re-run.

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.users')
    AND name = 'idx_users_email'
)
BEGIN
  DROP INDEX idx_users_email ON dbo.users;
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.users')
    AND name = 'uq_users_email'
)
BEGIN
  CREATE UNIQUE INDEX uq_users_email ON dbo.users (email);
END
