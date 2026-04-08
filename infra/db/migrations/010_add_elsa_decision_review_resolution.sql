-- Add review lifecycle fields so held Elsa decisions can be actioned and cleared.

IF COL_LENGTH('dbo.elsa_decisions', 'review_status') IS NULL
BEGIN
  ALTER TABLE dbo.elsa_decisions
    ADD review_status NVARCHAR(30) NULL;
END;

IF COL_LENGTH('dbo.elsa_decisions', 'review_action') IS NULL
BEGIN
  ALTER TABLE dbo.elsa_decisions
    ADD review_action NVARCHAR(40) NULL;
END;

IF COL_LENGTH('dbo.elsa_decisions', 'reviewed_by_user_id') IS NULL
BEGIN
  ALTER TABLE dbo.elsa_decisions
    ADD reviewed_by_user_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.elsa_decisions', 'reviewed_at') IS NULL
BEGIN
  ALTER TABLE dbo.elsa_decisions
    ADD reviewed_at DATETIMEOFFSET NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_elsa_decisions_reviewed_by_user')
BEGIN
  ALTER TABLE dbo.elsa_decisions
    ADD CONSTRAINT fk_elsa_decisions_reviewed_by_user
      FOREIGN KEY (reviewed_by_user_id) REFERENCES dbo.users (id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_elsa_decisions_review_status')
BEGIN
  CREATE INDEX idx_elsa_decisions_review_status
      ON dbo.elsa_decisions (request_id, policy_decision, review_status, reviewed_at DESC);
END;
