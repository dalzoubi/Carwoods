-- Rename Elsa decision tenant reply column to reflect raw AI draft semantics.
-- Idempotent: safe to re-run.

IF COL_LENGTH('dbo.elsa_decisions', 'tenant_reply_draft') IS NULL
BEGIN
  IF COL_LENGTH('dbo.elsa_decisions', 'normalized_tenant_reply') IS NOT NULL
  BEGIN
    EXEC sp_rename
      @objname = 'dbo.elsa_decisions.normalized_tenant_reply',
      @newname = 'tenant_reply_draft',
      @objtype = 'COLUMN';
  END
  ELSE
  BEGIN
    ALTER TABLE dbo.elsa_decisions
      ADD tenant_reply_draft NVARCHAR(MAX) NULL;
  END;
END;
