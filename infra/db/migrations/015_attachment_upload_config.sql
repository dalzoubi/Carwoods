-- Attachment upload configuration (global defaults + optional per-landlord overrides)
-- Phase 4: admin-managed DB policy

IF OBJECT_ID('attachment_upload_config', 'U') IS NULL
BEGIN
  CREATE TABLE attachment_upload_config (
    id                           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    scope_type                   NVARCHAR(20)     NOT NULL CHECK (scope_type IN ('GLOBAL', 'LANDLORD')),
    landlord_user_id             UNIQUEIDENTIFIER NULL REFERENCES users (id) ON DELETE CASCADE,
    max_attachments              INT              NOT NULL,
    max_image_bytes              BIGINT           NOT NULL,
    max_video_bytes              BIGINT           NOT NULL,
    max_video_duration_seconds   INT              NOT NULL,
    allowed_mime_types_json      NVARCHAR(MAX)    NOT NULL,
    allowed_extensions_json      NVARCHAR(MAX)    NOT NULL,
    share_enabled                BIT              NOT NULL DEFAULT 1,
    share_expiry_seconds         INT              NOT NULL,
    malware_scan_required        BIT              NOT NULL DEFAULT 0,
    updated_by_user_id           UNIQUEIDENTIFIER NULL REFERENCES users (id),
    updated_at                   DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'ux_attachment_upload_config_global'
)
BEGIN
  CREATE UNIQUE INDEX ux_attachment_upload_config_global
      ON attachment_upload_config (scope_type)
      WHERE scope_type = 'GLOBAL';
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'ux_attachment_upload_config_landlord'
)
BEGIN
  CREATE UNIQUE INDEX ux_attachment_upload_config_landlord
      ON attachment_upload_config (landlord_user_id)
      WHERE scope_type = 'LANDLORD' AND landlord_user_id IS NOT NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM attachment_upload_config
  WHERE scope_type = 'GLOBAL'
)
BEGIN
  INSERT INTO attachment_upload_config (
    scope_type,
    landlord_user_id,
    max_attachments,
    max_image_bytes,
    max_video_bytes,
    max_video_duration_seconds,
    allowed_mime_types_json,
    allowed_extensions_json,
    share_enabled,
    share_expiry_seconds,
    malware_scan_required
  )
  VALUES (
    'GLOBAL',
    NULL,
    3,
    10485760,
    52428800,
    10,
    '["image/*","video/*"]',
    '["jpg","jpeg","png","gif","webp","mp4","mov","webm"]',
    1,
    86400,
    0
  );
END;

