-- Repair partial 027 runs: a unique index on NVARCHAR(2000) exceeds SQL Server's 1700-byte
-- nonclustered index key limit. Adds persisted SHA-256 of storage_path and a unique index on it.
-- Idempotent: no-op when 027 already applied the hash column and indexes.

IF OBJECT_ID('dbo.document_upload_intents', 'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.document_upload_intents')
      AND name = N'uq_document_upload_intents_storage_path'
  )
    DROP INDEX uq_document_upload_intents_storage_path ON dbo.document_upload_intents;

  IF COL_LENGTH('dbo.document_upload_intents', 'storage_path_sha256') IS NULL
  BEGIN
    ALTER TABLE dbo.document_upload_intents ADD
      storage_path_sha256 AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', storage_path)) PERSISTED NOT NULL;
  END;
END;

IF OBJECT_ID('dbo.documents', 'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.documents')
      AND name = N'uq_documents_storage_path'
  )
    DROP INDEX uq_documents_storage_path ON dbo.documents;

  IF COL_LENGTH('dbo.documents', 'storage_path_sha256') IS NULL
  BEGIN
    ALTER TABLE dbo.documents ADD
      storage_path_sha256 AS CONVERT(VARBINARY(32), HASHBYTES('SHA2_256', storage_path)) PERSISTED NOT NULL;
  END;
END;
GO

IF OBJECT_ID('dbo.document_upload_intents', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.document_upload_intents', 'storage_path_sha256') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.document_upload_intents')
      AND name = N'uq_document_upload_intents_storage_path_sha256'
  )
BEGIN
  CREATE UNIQUE INDEX uq_document_upload_intents_storage_path_sha256
    ON dbo.document_upload_intents (storage_path_sha256);
END;

IF OBJECT_ID('dbo.documents', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.documents', 'storage_path_sha256') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.documents')
      AND name = N'uq_documents_storage_path_sha256'
  )
BEGIN
  CREATE UNIQUE INDEX uq_documents_storage_path_sha256
    ON dbo.documents (storage_path_sha256);
END;
