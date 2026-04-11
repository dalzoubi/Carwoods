import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGlobalAttachmentUploadConfigCached,
  getLandlordAttachmentUploadOverrideCached,
  invalidateAttachmentUploadConfigCache,
} from '../dist/src/lib/attachmentUploadConfigRepo.js';

function makeConfigRow(overrides = {}) {
  return {
    id: 'cfg-1',
    scope_type: 'GLOBAL',
    landlord_user_id: null,
    max_attachments: 3,
    max_image_bytes: 10 * 1024 * 1024,
    max_video_bytes: 50 * 1024 * 1024,
    max_video_duration_seconds: 10,
    allowed_mime_types_json: '["image/*","video/*"]',
    allowed_extensions_json: '["jpg","jpeg","png","mp4"]',
    share_enabled: true,
    share_expiry_seconds: 86400,
    malware_scan_required: false,
    updated_by_user_id: 'admin-1',
    updated_at: new Date('2026-04-10T10:00:00Z'),
    ...overrides,
  };
}

test('global attachment config cache avoids repeated DB queries within TTL', async () => {
  invalidateAttachmentUploadConfigCache();
  let queryCount = 0;
  const db = {
    async query() {
      queryCount += 1;
      return { rows: [makeConfigRow()] };
    },
  };

  const first = await getGlobalAttachmentUploadConfigCached(db);
  const second = await getGlobalAttachmentUploadConfigCached(db);

  assert.equal(queryCount, 1);
  assert.equal(first?.max_attachments, 3);
  assert.equal(second?.max_attachments, 3);
});

test('landlord override cache stores null responses and invalidates correctly', async () => {
  invalidateAttachmentUploadConfigCache();
  let queryCount = 0;
  const db = {
    async query(_sql, values = []) {
      queryCount += 1;
      if (values[0] === 'landlord-1' && queryCount === 1) {
        return { rows: [] };
      }
      return {
        rows: [
          makeConfigRow({
            id: 'override-1',
            scope_type: 'LANDLORD',
            landlord_user_id: 'landlord-1',
            max_attachments: 8,
          }),
        ],
      };
    },
  };

  const first = await getLandlordAttachmentUploadOverrideCached(db, 'landlord-1');
  const second = await getLandlordAttachmentUploadOverrideCached(db, 'landlord-1');
  assert.equal(first, null);
  assert.equal(second, null);
  assert.equal(queryCount, 1);

  invalidateAttachmentUploadConfigCache();
  const third = await getLandlordAttachmentUploadOverrideCached(db, 'landlord-1');
  assert.equal(third?.max_attachments, 8);
  assert.equal(queryCount, 2);
});
