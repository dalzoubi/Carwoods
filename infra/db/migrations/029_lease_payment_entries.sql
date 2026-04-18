-- Lease-scoped rent payment records (due vs paid) per billing period.

CREATE TABLE lease_payment_entries (
    id              UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID()  PRIMARY KEY,
    lease_id        UNIQUEIDENTIFIER  NOT NULL REFERENCES leases (id) ON DELETE NO ACTION,
    -- First day of the billing period (e.g. 2026-05-01 for May 2026).
    period_start    DATE              NOT NULL,
    amount_due      DECIMAL(10, 2)    NOT NULL,
    amount_paid     DECIMAL(10, 2)    NOT NULL DEFAULT 0,
    due_date        DATE              NOT NULL,
    paid_date       DATE              NULL,
    payment_method  NVARCHAR(50)      NULL
                    CHECK (payment_method IN ('CHECK', 'CASH', 'BANK_TRANSFER', 'ZELLE', 'VENMO', 'OTHER')),
    notes           NVARCHAR(500)     NULL,
    recorded_by     UNIQUEIDENTIFIER  NULL REFERENCES users (id),
    created_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    deleted_at      DATETIMEOFFSET    NULL,
    CONSTRAINT uq_lease_payment_lease_period UNIQUE (lease_id, period_start)
);

CREATE INDEX idx_lease_payment_lease_id ON lease_payment_entries (lease_id)
    WHERE deleted_at IS NULL;
