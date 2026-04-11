import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoDurationSeconds } from '../dist/src/domain/requestAttachmentPolicy.js';
import { createRequestAttachmentShareLink } from '../dist/src/useCases/requests/createRequestAttachmentShareLink.js';
import { invalidateAttachmentUploadConfigCache } from '../dist/src/lib/attachmentUploadConfigRepo.js';

test('validateVideoDurationSeconds requires duration for video uploads', () => {
  assert.throws(
    () => validateVideoDurationSeconds('VIDEO', undefined, 10),
    (error) => error?.message === 'missing_video_duration'
  );
  assert.doesNotThrow(() => validateVideoDurationSeconds('PHOTO', undefined, 10));
  assert.throws(
    () => validateVideoDurationSeconds('VIDEO', 12, 10),
    (error) => error?.message === 'video_too_long' && error?.max_seconds === 10
  );
});

test('createRequestAttachmentShareLink blocks tenant role', async () => {
  invalidateAttachmentUploadConfigCache();
  await assert.rejects(
    createRequestAttachmentShareLink(
      {
        async query() {
          return { rows: [] };
        },
        async connect() {
          throw new Error('connect_should_not_be_called');
        },
      },
      {
        requestId: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
        attachmentId: '63f71e58-0462-4f2b-9aae-9174260df106',
        actorUserId: 'tenant-1',
        actorRole: 'TENANT',
      }
    ),
    (error) => error?.message === 'forbidden'
  );
});

test('createRequestAttachmentShareLink returns validation when sharing disabled', async () => {
  invalidateAttachmentUploadConfigCache();
  const db = {
    async query(sql, values = []) {
      if (sql.includes('FROM request_attachments')) {
        return {
          rows: [
            {
              id: '63f71e58-0462-4f2b-9aae-9174260df106',
              request_id: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
              uploaded_by_user_id: 'tenant-1',
              uploaded_by_display_name: 'Tenant One',
              uploaded_by_role: 'TENANT',
              storage_path: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d/sample.jpg',
              original_filename: 'sample.jpg',
              content_type: 'image/jpeg',
              file_size_bytes: 1234,
              media_type: 'PHOTO',
              created_at: new Date('2026-01-01T00:00:00Z'),
            },
          ],
        };
      }
      if (sql.includes("FROM attachment_upload_config") && sql.includes("scope_type = 'GLOBAL'")) {
        return {
          rows: [
            {
              id: 'cfg-1',
              scope_type: 'GLOBAL',
              landlord_user_id: null,
              max_attachments: 3,
              max_image_bytes: 10485760,
              max_video_bytes: 52428800,
              max_video_duration_seconds: 10,
              allowed_mime_types_json: '["image/*","video/*"]',
              allowed_extensions_json: '["jpg","jpeg","png","mp4"]',
              share_enabled: false,
              share_expiry_seconds: 900,
              malware_scan_required: false,
              updated_by_user_id: 'admin-1',
              updated_at: new Date('2026-01-01T00:00:00Z'),
            },
          ],
        };
      }
      if (sql.includes('FROM maintenance_requests')) {
        return { rows: [{ landlord_user_id: null }] };
      }
      return { rows: [] };
    },
    async connect() {
      throw new Error('connect_should_not_be_called_when_sharing_disabled');
    },
  };

  await assert.rejects(
    createRequestAttachmentShareLink(db, {
      requestId: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
      attachmentId: '63f71e58-0462-4f2b-9aae-9174260df106',
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
    }),
    (error) => error?.message === 'attachment_share_disabled'
  );
});
