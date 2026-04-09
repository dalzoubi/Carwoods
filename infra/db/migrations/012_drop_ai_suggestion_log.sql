-- Drop legacy AI suggestion observability table.
-- The suggest-reply flow was removed; this table is now orphaned.
-- Idempotent: safe to re-run.

IF OBJECT_ID('dbo.ai_suggestion_log', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.ai_suggestion_log;
END;
