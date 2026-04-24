-- Generalize payment lines: property / property+tenant / lease scope, tenant visibility flag,
-- and rename lease_payment_entries -> payment_entries.
-- Use GO between steps: SQL Server does not expose new columns to later statements in the same batch.

-- 1) New columns
IF COL_LENGTH('dbo.lease_payment_entries', 'show_in_tenant_portal') IS NULL
BEGIN
  ALTER TABLE dbo.lease_payment_entries ADD
    show_in_tenant_portal BIT NOT NULL
      CONSTRAINT DF_lease_payment_entries_show_tenant_portal DEFAULT (1);
END;
GO

IF COL_LENGTH('dbo.lease_payment_entries', 'property_id') IS NULL
BEGIN
  ALTER TABLE dbo.lease_payment_entries ADD property_id UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH('dbo.lease_payment_entries', 'tenant_user_id') IS NULL
BEGIN
  ALTER TABLE dbo.lease_payment_entries ADD tenant_user_id UNIQUEIDENTIFIER NULL;
END;
GO

-- 2) Drop FK on lease_id so we can make it nullable
DECLARE @fk_lease NVARCHAR(256);
DECLARE @drop_fk_sql NVARCHAR(512);
SELECT @fk_lease = fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
INNER JOIN sys.columns c
  ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.lease_payment_entries')
  AND c.name = 'lease_id';

IF @fk_lease IS NOT NULL
BEGIN
  SET @drop_fk_sql = N'ALTER TABLE dbo.lease_payment_entries DROP CONSTRAINT ' + N'[' + REPLACE(@fk_lease, N']', N']]') + N']';
  EXEC sys.sp_executesql @drop_fk_sql;
END
GO

ALTER TABLE dbo.lease_payment_entries ALTER COLUMN lease_id UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_payment_entries_lease' AND parent_object_id = OBJECT_ID('dbo.lease_payment_entries')
)
BEGIN
  ALTER TABLE dbo.lease_payment_entries
    ADD CONSTRAINT FK_payment_entries_lease
    FOREIGN KEY (lease_id) REFERENCES dbo.leases (id) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_payment_entries_property' AND parent_object_id = OBJECT_ID('dbo.lease_payment_entries')
)
BEGIN
  ALTER TABLE dbo.lease_payment_entries
    ADD CONSTRAINT FK_payment_entries_property
    FOREIGN KEY (property_id) REFERENCES dbo.properties (id) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_payment_entries_tenant_user' AND parent_object_id = OBJECT_ID('dbo.lease_payment_entries')
)
BEGIN
  ALTER TABLE dbo.lease_payment_entries
    ADD CONSTRAINT FK_payment_entries_tenant_user
    FOREIGN KEY (tenant_user_id) REFERENCES dbo.users (id) ON DELETE NO ACTION;
END;
GO

-- 3) Replace table-scoped unique with filtered uniques (soft-delete–safe)
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'uq_lease_payment_lease_period_type' AND parent_object_id = OBJECT_ID('dbo.lease_payment_entries')
)
  ALTER TABLE dbo.lease_payment_entries DROP CONSTRAINT uq_lease_payment_lease_period_type;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'uq_payment_entries_lease_period_type' AND object_id = OBJECT_ID('dbo.lease_payment_entries')
)
  CREATE UNIQUE NONCLUSTERED INDEX uq_payment_entries_lease_period_type
  ON dbo.lease_payment_entries (lease_id, period_start, payment_type)
  WHERE lease_id IS NOT NULL AND deleted_at IS NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'uq_payment_entries_property_period_type' AND object_id = OBJECT_ID('dbo.lease_payment_entries')
)
  CREATE UNIQUE NONCLUSTERED INDEX uq_payment_entries_property_period_type
  ON dbo.lease_payment_entries (property_id, period_start, payment_type)
  WHERE property_id IS NOT NULL
    AND lease_id IS NULL
    AND tenant_user_id IS NULL
    AND deleted_at IS NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'uq_payment_entries_property_tenant_period_type' AND object_id = OBJECT_ID('dbo.lease_payment_entries')
)
  CREATE UNIQUE NONCLUSTERED INDEX uq_payment_entries_property_tenant_period_type
  ON dbo.lease_payment_entries (property_id, tenant_user_id, period_start, payment_type)
  WHERE property_id IS NOT NULL
    AND tenant_user_id IS NOT NULL
    AND lease_id IS NULL
    AND deleted_at IS NULL;
GO

-- 4) Scope: exactly one of (lease), (property only), (property + tenant)
IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = 'CK_payment_entries_scope' AND parent_object_id = OBJECT_ID('dbo.lease_payment_entries')
)
  ALTER TABLE dbo.lease_payment_entries
    ADD CONSTRAINT CK_payment_entries_scope CHECK (
      (
        lease_id IS NOT NULL
        AND property_id IS NULL
        AND tenant_user_id IS NULL
      )
      OR
      (
        lease_id IS NULL
        AND property_id IS NOT NULL
        AND tenant_user_id IS NULL
      )
      OR
      (
        lease_id IS NULL
        AND property_id IS NOT NULL
        AND tenant_user_id IS NOT NULL
      )
    );
GO

-- 5) Rename table
IF OBJECT_ID('dbo.payment_entries', 'U') IS NULL AND OBJECT_ID('dbo.lease_payment_entries', 'U') IS NOT NULL
  EXEC sp_rename 'dbo.lease_payment_entries', 'payment_entries';
GO

-- 6) Rename old index on lease_id for consistency (if present)
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_lease_payment_lease_id' AND object_id = OBJECT_ID('dbo.payment_entries')
)
  EXEC sp_rename N'dbo.payment_entries.idx_lease_payment_lease_id', N'idx_payment_entries_lease_id', N'INDEX';
GO

-- 7) Rename type check constraint to match new table
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = 'CK_lease_payment_entries_payment_type' AND parent_object_id = OBJECT_ID('dbo.payment_entries')
)
  EXEC sp_rename N'CK_lease_payment_entries_payment_type', N'CK_payment_entries_payment_type', N'OBJECT';
GO
