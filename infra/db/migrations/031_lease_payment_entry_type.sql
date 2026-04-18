-- Payment category (rent, deposit, fees, etc.). Replaces unique (lease_id, period_start)
-- with (lease_id, period_start, payment_type) so multiple charge types can share one period.
--
-- Use GO between steps: SQL Server does not expose new columns to later statements in the
-- same batch (see apps/api/scripts/runMigrations.mjs splitSqlBatches).

ALTER TABLE lease_payment_entries
ADD payment_type NVARCHAR(50) NOT NULL
    CONSTRAINT DF_lease_payment_entries_payment_type DEFAULT ('RENT');
GO

ALTER TABLE lease_payment_entries DROP CONSTRAINT uq_lease_payment_lease_period;
GO

ALTER TABLE lease_payment_entries
ADD CONSTRAINT CK_lease_payment_entries_payment_type CHECK (payment_type IN (
    'RENT',
    'SECURITY_DEPOSIT',
    'LATE_FEE',
    'PET_FEE',
    'PARKING',
    'UTILITY',
    'APPLICATION_FEE',
    'ADMIN_FEE',
    'NSF_FEE',
    'MAINTENANCE',
    'OTHER'
));
GO

ALTER TABLE lease_payment_entries
ADD CONSTRAINT uq_lease_payment_lease_period_type UNIQUE (lease_id, period_start, payment_type);
