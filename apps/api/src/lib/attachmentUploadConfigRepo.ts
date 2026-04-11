import type { PoolClient, QueryResult } from './db.js';
import type { AttachmentUploadConfig, AttachmentUploadConfigInput } from '../domain/attachmentUploadConfig.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

type AttachmentUploadConfigRow = {
  id: string;
  scope_type: 'GLOBAL' | 'LANDLORD';
  landlord_user_id: string | null;
  max_attachments: number;
  max_image_bytes: number;
  max_video_bytes: number;
  max_video_duration_seconds: number;
  allowed_mime_types_json: string;
  allowed_extensions_json: string;
  share_enabled: boolean;
  share_expiry_seconds: number;
  malware_scan_required: boolean;
  updated_by_user_id: string | null;
  updated_at: Date;
};

function parseStringArrayJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry ?? '').trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function mapRow(row: AttachmentUploadConfigRow): AttachmentUploadConfig {
  return {
    id: row.id,
    scope_type: row.scope_type,
    landlord_user_id: row.landlord_user_id,
    max_attachments: Number(row.max_attachments),
    max_image_bytes: Number(row.max_image_bytes),
    max_video_bytes: Number(row.max_video_bytes),
    max_video_duration_seconds: Number(row.max_video_duration_seconds),
    allowed_mime_types: parseStringArrayJson(row.allowed_mime_types_json),
    allowed_extensions: parseStringArrayJson(row.allowed_extensions_json),
    share_enabled: Boolean(row.share_enabled),
    share_expiry_seconds: Number(row.share_expiry_seconds),
    malware_scan_required: Boolean(row.malware_scan_required),
    updated_by_user_id: row.updated_by_user_id,
    updated_at: row.updated_at,
  };
}

export async function getGlobalAttachmentUploadConfig(client: Queryable): Promise<AttachmentUploadConfig | null> {
  const r = await client.query<AttachmentUploadConfigRow>(
    `SELECT TOP 1
       CONVERT(NVARCHAR(36), id) AS id,
       scope_type,
       CONVERT(NVARCHAR(36), landlord_user_id) AS landlord_user_id,
       max_attachments,
       max_image_bytes,
       max_video_bytes,
       max_video_duration_seconds,
       allowed_mime_types_json,
       allowed_extensions_json,
       share_enabled,
       share_expiry_seconds,
       malware_scan_required,
       CONVERT(NVARCHAR(36), updated_by_user_id) AS updated_by_user_id,
       updated_at
     FROM attachment_upload_config
     WHERE scope_type = 'GLOBAL'`
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function listLandlordAttachmentUploadOverrides(
  client: Queryable
): Promise<Array<AttachmentUploadConfig & { landlord_display_name: string | null; landlord_email: string | null }>> {
  const r = await client.query<AttachmentUploadConfigRow & { landlord_display_name: string | null; landlord_email: string | null }>(
    `SELECT
       CONVERT(NVARCHAR(36), c.id) AS id,
       c.scope_type,
       CONVERT(NVARCHAR(36), c.landlord_user_id) AS landlord_user_id,
       c.max_attachments,
       c.max_image_bytes,
       c.max_video_bytes,
       c.max_video_duration_seconds,
       c.allowed_mime_types_json,
       c.allowed_extensions_json,
       c.share_enabled,
       c.share_expiry_seconds,
       c.malware_scan_required,
       CONVERT(NVARCHAR(36), c.updated_by_user_id) AS updated_by_user_id,
       c.updated_at,
       CASE
         WHEN LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) = '' THEN u.email
         ELSE LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')))
       END AS landlord_display_name,
       u.email AS landlord_email
     FROM attachment_upload_config c
     LEFT JOIN users u ON u.id = c.landlord_user_id
     WHERE c.scope_type = 'LANDLORD'
     ORDER BY c.updated_at DESC`
  );
  return r.rows.map((row) => ({
    ...mapRow(row),
    landlord_display_name: row.landlord_display_name,
    landlord_email: row.landlord_email,
  }));
}

export async function getLandlordAttachmentUploadOverride(
  client: Queryable,
  landlordUserId: string
): Promise<AttachmentUploadConfig | null> {
  const r = await client.query<AttachmentUploadConfigRow>(
    `SELECT TOP 1
       CONVERT(NVARCHAR(36), id) AS id,
       scope_type,
       CONVERT(NVARCHAR(36), landlord_user_id) AS landlord_user_id,
       max_attachments,
       max_image_bytes,
       max_video_bytes,
       max_video_duration_seconds,
       allowed_mime_types_json,
       allowed_extensions_json,
       share_enabled,
       share_expiry_seconds,
       malware_scan_required,
       CONVERT(NVARCHAR(36), updated_by_user_id) AS updated_by_user_id,
       updated_at
     FROM attachment_upload_config
     WHERE scope_type = 'LANDLORD'
       AND landlord_user_id = $1`,
    [landlordUserId]
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function upsertGlobalAttachmentUploadConfig(
  client: PoolClient,
  actorUserId: string,
  input: AttachmentUploadConfigInput
): Promise<AttachmentUploadConfig> {
  const r = await client.query<AttachmentUploadConfigRow>(
    `MERGE attachment_upload_config AS target
     USING (
      SELECT
        'GLOBAL' AS scope_type,
        CAST(NULL AS UNIQUEIDENTIFIER) AS landlord_user_id,
        $1 AS max_attachments,
        $2 AS max_image_bytes,
        $3 AS max_video_bytes,
        $4 AS max_video_duration_seconds,
        $5 AS allowed_mime_types_json,
        $6 AS allowed_extensions_json,
        $7 AS share_enabled,
        $8 AS share_expiry_seconds,
        $9 AS malware_scan_required,
        CAST($10 AS UNIQUEIDENTIFIER) AS updated_by_user_id
     ) AS src
       ON target.scope_type = src.scope_type
      AND target.landlord_user_id IS NULL
     WHEN MATCHED THEN
      UPDATE SET
        max_attachments = src.max_attachments,
        max_image_bytes = src.max_image_bytes,
        max_video_bytes = src.max_video_bytes,
        max_video_duration_seconds = src.max_video_duration_seconds,
        allowed_mime_types_json = src.allowed_mime_types_json,
        allowed_extensions_json = src.allowed_extensions_json,
        share_enabled = src.share_enabled,
        share_expiry_seconds = src.share_expiry_seconds,
        malware_scan_required = src.malware_scan_required,
        updated_by_user_id = src.updated_by_user_id,
        updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
      INSERT (
        id, scope_type, landlord_user_id, max_attachments, max_image_bytes, max_video_bytes,
        max_video_duration_seconds, allowed_mime_types_json, allowed_extensions_json,
        share_enabled, share_expiry_seconds, malware_scan_required, updated_by_user_id
      )
      VALUES (
        NEWID(), src.scope_type, src.landlord_user_id, src.max_attachments, src.max_image_bytes, src.max_video_bytes,
        src.max_video_duration_seconds, src.allowed_mime_types_json, src.allowed_extensions_json,
        src.share_enabled, src.share_expiry_seconds, src.malware_scan_required, src.updated_by_user_id
      )
     OUTPUT
      CONVERT(NVARCHAR(36), inserted.id) AS id,
      inserted.scope_type,
      CONVERT(NVARCHAR(36), inserted.landlord_user_id) AS landlord_user_id,
      inserted.max_attachments,
      inserted.max_image_bytes,
      inserted.max_video_bytes,
      inserted.max_video_duration_seconds,
      inserted.allowed_mime_types_json,
      inserted.allowed_extensions_json,
      inserted.share_enabled,
      inserted.share_expiry_seconds,
      inserted.malware_scan_required,
      CONVERT(NVARCHAR(36), inserted.updated_by_user_id) AS updated_by_user_id,
      inserted.updated_at;`,
    [
      input.max_attachments,
      input.max_image_bytes,
      input.max_video_bytes,
      input.max_video_duration_seconds,
      JSON.stringify(input.allowed_mime_types),
      JSON.stringify(input.allowed_extensions),
      input.share_enabled ? 1 : 0,
      input.share_expiry_seconds,
      input.malware_scan_required ? 1 : 0,
      actorUserId,
    ]
  );
  return mapRow(r.rows[0]!);
}

export async function upsertLandlordAttachmentUploadConfig(
  client: PoolClient,
  landlordUserId: string,
  actorUserId: string,
  input: AttachmentUploadConfigInput
): Promise<AttachmentUploadConfig> {
  const r = await client.query<AttachmentUploadConfigRow>(
    `MERGE attachment_upload_config AS target
     USING (
      SELECT
        'LANDLORD' AS scope_type,
        CAST($1 AS UNIQUEIDENTIFIER) AS landlord_user_id,
        $2 AS max_attachments,
        $3 AS max_image_bytes,
        $4 AS max_video_bytes,
        $5 AS max_video_duration_seconds,
        $6 AS allowed_mime_types_json,
        $7 AS allowed_extensions_json,
        $8 AS share_enabled,
        $9 AS share_expiry_seconds,
        $10 AS malware_scan_required,
        CAST($11 AS UNIQUEIDENTIFIER) AS updated_by_user_id
     ) AS src
       ON target.scope_type = src.scope_type
      AND target.landlord_user_id = src.landlord_user_id
     WHEN MATCHED THEN
      UPDATE SET
        max_attachments = src.max_attachments,
        max_image_bytes = src.max_image_bytes,
        max_video_bytes = src.max_video_bytes,
        max_video_duration_seconds = src.max_video_duration_seconds,
        allowed_mime_types_json = src.allowed_mime_types_json,
        allowed_extensions_json = src.allowed_extensions_json,
        share_enabled = src.share_enabled,
        share_expiry_seconds = src.share_expiry_seconds,
        malware_scan_required = src.malware_scan_required,
        updated_by_user_id = src.updated_by_user_id,
        updated_at = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN
      INSERT (
        id, scope_type, landlord_user_id, max_attachments, max_image_bytes, max_video_bytes,
        max_video_duration_seconds, allowed_mime_types_json, allowed_extensions_json,
        share_enabled, share_expiry_seconds, malware_scan_required, updated_by_user_id
      )
      VALUES (
        NEWID(), src.scope_type, src.landlord_user_id, src.max_attachments, src.max_image_bytes, src.max_video_bytes,
        src.max_video_duration_seconds, src.allowed_mime_types_json, src.allowed_extensions_json,
        src.share_enabled, src.share_expiry_seconds, src.malware_scan_required, src.updated_by_user_id
      )
     OUTPUT
      CONVERT(NVARCHAR(36), inserted.id) AS id,
      inserted.scope_type,
      CONVERT(NVARCHAR(36), inserted.landlord_user_id) AS landlord_user_id,
      inserted.max_attachments,
      inserted.max_image_bytes,
      inserted.max_video_bytes,
      inserted.max_video_duration_seconds,
      inserted.allowed_mime_types_json,
      inserted.allowed_extensions_json,
      inserted.share_enabled,
      inserted.share_expiry_seconds,
      inserted.malware_scan_required,
      CONVERT(NVARCHAR(36), inserted.updated_by_user_id) AS updated_by_user_id,
      inserted.updated_at;`,
    [
      landlordUserId,
      input.max_attachments,
      input.max_image_bytes,
      input.max_video_bytes,
      input.max_video_duration_seconds,
      JSON.stringify(input.allowed_mime_types),
      JSON.stringify(input.allowed_extensions),
      input.share_enabled ? 1 : 0,
      input.share_expiry_seconds,
      input.malware_scan_required ? 1 : 0,
      actorUserId,
    ]
  );
  return mapRow(r.rows[0]!);
}

export async function deleteLandlordAttachmentUploadOverride(
  client: PoolClient,
  landlordUserId: string
): Promise<AttachmentUploadConfig | null> {
  const r = await client.query<AttachmentUploadConfigRow>(
    `DELETE FROM attachment_upload_config
     OUTPUT
      CONVERT(NVARCHAR(36), deleted.id) AS id,
      deleted.scope_type,
      CONVERT(NVARCHAR(36), deleted.landlord_user_id) AS landlord_user_id,
      deleted.max_attachments,
      deleted.max_image_bytes,
      deleted.max_video_bytes,
      deleted.max_video_duration_seconds,
      deleted.allowed_mime_types_json,
      deleted.allowed_extensions_json,
      deleted.share_enabled,
      deleted.share_expiry_seconds,
      deleted.malware_scan_required,
      CONVERT(NVARCHAR(36), deleted.updated_by_user_id) AS updated_by_user_id,
      deleted.updated_at
     WHERE scope_type = 'LANDLORD'
       AND landlord_user_id = $1`,
    [landlordUserId]
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function findRequestLandlordUserId(
  client: Queryable,
  requestId: string
): Promise<string | null> {
  const r = await client.query<{ landlord_user_id: string | null }>(
    `SELECT TOP 1 CONVERT(NVARCHAR(36), p.created_by) AS landlord_user_id
     FROM maintenance_requests mr
     LEFT JOIN properties p ON p.id = mr.property_id
     WHERE mr.id = $1
       AND mr.deleted_at IS NULL`,
    [requestId]
  );
  return r.rows[0]?.landlord_user_id ?? null;
}

