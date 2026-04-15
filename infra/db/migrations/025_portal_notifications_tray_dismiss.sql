-- Cross-device "dismiss from bell tray" for portal_notifications.

IF COL_LENGTH('dbo.portal_notifications', 'dismissed_from_tray_at') IS NULL
BEGIN
  ALTER TABLE dbo.portal_notifications
    ADD dismissed_from_tray_at DATETIMEOFFSET NULL;
END;
