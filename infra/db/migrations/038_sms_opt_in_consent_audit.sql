-- ---------------------------------------------------------------------------
-- SMS opt-in consent audit metadata (CTIA / Telnyx toll-free verification)
--
-- Adds explicit consent-capture columns to user_notification_preferences so we
-- can prove, for any opted-in user, WHEN / WHERE / on WHICH CONSENT VERSION
-- they agreed to receive transactional SMS from Carwoods, plus parallel
-- opt-out fields for audit history.
-- ---------------------------------------------------------------------------

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_in_at') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_in_at DATETIMEOFFSET NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_in_source') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_in_source NVARCHAR(64) NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_in_version') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_in_version NVARCHAR(32) NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_in_ip') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_in_ip NVARCHAR(64) NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_in_user_agent') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_in_user_agent NVARCHAR(512) NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_in_phone') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_in_phone NVARCHAR(64) NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_out_at') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_out_at DATETIMEOFFSET NULL;
END;

IF COL_LENGTH('dbo.user_notification_preferences', 'sms_opt_out_source') IS NULL
BEGIN
  ALTER TABLE dbo.user_notification_preferences
    ADD sms_opt_out_source NVARCHAR(64) NULL;
END;
