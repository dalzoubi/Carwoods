-- Persist whether the user has finished the portal onboarding tour (cross-device).

IF COL_LENGTH('dbo.users', 'portal_tour_completed') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD portal_tour_completed BIT NOT NULL
      CONSTRAINT DF_users_portal_tour_completed DEFAULT (0);
END
