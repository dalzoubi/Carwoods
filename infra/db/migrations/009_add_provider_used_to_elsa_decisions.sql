-- Backfill migration for environments where 008 was already marked applied
-- before provider_used was added.
IF COL_LENGTH('dbo.elsa_decisions', 'provider_used') IS NULL
BEGIN
  ALTER TABLE dbo.elsa_decisions
    ADD provider_used NVARCHAR(40) NULL;
END;
