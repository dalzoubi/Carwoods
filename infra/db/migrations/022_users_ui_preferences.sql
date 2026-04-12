-- Store per-user UI preferences so language and color-scheme are synced
-- across devices when the user is authenticated in the portal.

IF COL_LENGTH('dbo.users', 'ui_language') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD ui_language NVARCHAR(8) NULL;
END

IF COL_LENGTH('dbo.users', 'ui_color_scheme') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD ui_color_scheme NVARCHAR(8) NULL;
END
