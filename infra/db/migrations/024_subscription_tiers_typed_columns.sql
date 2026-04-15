-- Replace JSON `limits` on subscription_tiers with typed columns (Option A).
-- Preserves tier row ids for users.tier_id FK stability.

IF COL_LENGTH('dbo.subscription_tiers', 'max_properties') IS NULL
BEGIN
  ALTER TABLE dbo.subscription_tiers ADD
    max_properties INT NOT NULL CONSTRAINT df_subscription_tiers_max_properties DEFAULT (-1),
    max_tenants INT NOT NULL CONSTRAINT df_subscription_tiers_max_tenants DEFAULT (-1),
    ai_routing_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_ai_routing DEFAULT (1),
    csv_export_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_csv_export DEFAULT (1),
    custom_notifications_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_custom_notifications DEFAULT (0),
    notification_email_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_notif_email DEFAULT (1),
    notification_sms_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_notif_sms DEFAULT (0),
    maintenance_request_history_days INT NOT NULL CONSTRAINT df_subscription_tiers_maint_hist DEFAULT (-1),
    request_photo_video_attachments_enabled BIT NOT NULL CONSTRAINT df_subscription_tiers_req_media DEFAULT (1),
    property_apply_visibility_editable BIT NOT NULL CONSTRAINT df_subscription_tiers_apply_vis DEFAULT (1);
END;

-- Added after other typed columns; separate batch so DBs that already ran an older 024
-- (max_properties present, this column missing) still get the column before UPDATEs below.
IF COL_LENGTH('dbo.subscription_tiers', 'property_elsa_auto_send_editable') IS NULL
BEGIN
  ALTER TABLE dbo.subscription_tiers ADD
    property_elsa_auto_send_editable BIT NOT NULL CONSTRAINT df_subscription_tiers_elsa_prop DEFAULT (1);
END;

-- New columns are not visible until the next batch (SQL Server ALTER + same-batch UPDATE rule).
GO

-- Seed from known tier names (works whether or not legacy JSON matched).
UPDATE dbo.subscription_tiers
SET
  max_properties = 1,
  max_tenants = 5,
  ai_routing_enabled = 0,
  csv_export_enabled = 0,
  custom_notifications_enabled = 0,
  notification_email_enabled = 0,
  notification_sms_enabled = 0,
  maintenance_request_history_days = 90,
  request_photo_video_attachments_enabled = 0,
  property_apply_visibility_editable = 0,
  property_elsa_auto_send_editable = 0
WHERE UPPER(LTRIM(RTRIM(name))) = 'FREE';

UPDATE dbo.subscription_tiers
SET
  max_properties = 5,
  max_tenants = 25,
  ai_routing_enabled = 1,
  csv_export_enabled = 1,
  custom_notifications_enabled = 0,
  notification_email_enabled = 1,
  notification_sms_enabled = 0,
  maintenance_request_history_days = -1,
  request_photo_video_attachments_enabled = 1,
  property_apply_visibility_editable = 1,
  property_elsa_auto_send_editable = 1
WHERE UPPER(LTRIM(RTRIM(name))) = 'STARTER';

UPDATE dbo.subscription_tiers
SET
  max_properties = -1,
  max_tenants = -1,
  ai_routing_enabled = 1,
  csv_export_enabled = 1,
  custom_notifications_enabled = 1,
  notification_email_enabled = 1,
  notification_sms_enabled = 1,
  maintenance_request_history_days = -1,
  request_photo_video_attachments_enabled = 1,
  property_apply_visibility_editable = 1,
  property_elsa_auto_send_editable = 1
WHERE UPPER(LTRIM(RTRIM(name))) = 'PRO';

-- Drop legacy JSON column when present (drop default constraint first; otherwise
-- ALTER TABLE DROP COLUMN can fail: "one or more objects access this column").
IF COL_LENGTH('dbo.subscription_tiers', 'limits') IS NOT NULL
BEGIN
  DECLARE @limits_default SYSNAME;
  DECLARE @drop_limits_def NVARCHAR(400);

  SELECT @limits_default = dc.name
  FROM sys.default_constraints AS dc
  INNER JOIN sys.columns AS c
    ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID(N'dbo.subscription_tiers')
    AND c.name = N'limits';

  IF @limits_default IS NOT NULL
  BEGIN
    SET @drop_limits_def =
      N'ALTER TABLE dbo.subscription_tiers DROP CONSTRAINT ' + QUOTENAME(@limits_default) + N';';
    EXEC sys.sp_executesql @drop_limits_def;
  END;

  ALTER TABLE dbo.subscription_tiers DROP COLUMN limits;
END;
