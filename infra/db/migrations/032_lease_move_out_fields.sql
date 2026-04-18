-- Lease move-out, termination, and tenant-notice fields.
--
-- The `status` column already accepts ('ACTIVE','UPCOMING','ENDED','TERMINATED')
-- so no enum change is needed:
--   ENDED       = normal move-out / end-of-term / mutual
--   TERMINATED  = eviction or tenant-initiated early termination
-- The reason sub-type is recorded in `ended_reason`.
--
-- Idempotent — safe to re-run if a prior attempt half-applied.

IF COL_LENGTH('dbo.leases', 'ended_on') IS NULL
BEGIN
  ALTER TABLE dbo.leases ADD
    ended_on      DATE              NULL,
    ended_reason  NVARCHAR(30)      NULL
      CONSTRAINT ck_leases_ended_reason
      CHECK (ended_reason IS NULL
             OR ended_reason IN ('end_of_term', 'early_termination', 'eviction', 'mutual', 'other')),
    ended_by      UNIQUEIDENTIFIER  NULL
      CONSTRAINT fk_leases_ended_by REFERENCES users (id),
    ended_notes   NVARCHAR(MAX)     NULL;
END;
GO

IF COL_LENGTH('dbo.leases', 'notice_period_days') IS NULL
BEGIN
  ALTER TABLE dbo.leases ADD
    notice_period_days  INT  NOT NULL
      CONSTRAINT df_leases_notice_period_days DEFAULT 30
      CONSTRAINT ck_leases_notice_period_days CHECK (notice_period_days >= 0);
END;
GO

IF COL_LENGTH('dbo.leases', 'notice_given_on') IS NULL
BEGIN
  ALTER TABLE dbo.leases ADD
    notice_given_on       DATE  NULL,
    notice_move_out_date  DATE  NULL;
END;
GO

IF COL_LENGTH('dbo.leases', 'early_termination_fee_amount') IS NULL
BEGIN
  ALTER TABLE dbo.leases ADD
    early_termination_fee_amount  DECIMAL(12, 2)  NULL,
    early_termination_notes       NVARCHAR(MAX)   NULL;
END;
GO

-- Default notice period: 30 for month-to-month, 60 for fixed-term.
-- (The DEFAULT above seeded every row with 30; this UPDATE only bumps fixed-term rows to 60.)
UPDATE dbo.leases
   SET notice_period_days = 60
 WHERE month_to_month = 0
   AND notice_period_days = 30;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_leases_notice_move_out_date' AND object_id = OBJECT_ID('dbo.leases'))
BEGIN
  CREATE INDEX idx_leases_notice_move_out_date
    ON dbo.leases (notice_move_out_date)
    WHERE notice_move_out_date IS NOT NULL AND deleted_at IS NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_leases_ended_on' AND object_id = OBJECT_ID('dbo.leases'))
BEGIN
  CREATE INDEX idx_leases_ended_on
    ON dbo.leases (ended_on DESC)
    WHERE ended_on IS NOT NULL AND deleted_at IS NULL;
END;
GO
