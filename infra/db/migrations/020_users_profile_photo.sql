-- Portal profile photos: store Azure Blob path (not public URL) per user.
-- Blobs live under profile-photos/{user_id}/... in the existing attachments container.

IF COL_LENGTH('dbo.users', 'profile_photo_storage_path') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD profile_photo_storage_path NVARCHAR(512) NULL;
END
