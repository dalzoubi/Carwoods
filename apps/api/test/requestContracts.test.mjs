import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateMaintenanceRequest,
  canPostInternalMessages,
  canViewInternalMessages,
} from '../dist/src/lib/requestAccessPolicy.js';
import {
  detectMediaType,
  maxBytesForMediaType,
} from '../dist/src/domain/requestValidation.js';

test('tenant role can create request but cannot use internal messages', () => {
  assert.equal(canCreateMaintenanceRequest('TENANT'), true);
  assert.equal(canViewInternalMessages('TENANT'), false);
  assert.equal(canPostInternalMessages('TENANT'), false);
});

test('management roles can view/post internal messages', () => {
  assert.equal(canViewInternalMessages('ADMIN'), true);
  assert.equal(canPostInternalMessages('ADMIN'), true);
  assert.equal(canViewInternalMessages('LANDLORD'), true);
  assert.equal(canPostInternalMessages('LANDLORD'), true);
});

test('upload media detection and byte ceilings', () => {
  assert.equal(detectMediaType('image/jpeg'), 'PHOTO');
  assert.equal(detectMediaType('video/mp4'), 'VIDEO');
  assert.equal(detectMediaType('application/pdf'), 'FILE');
  assert.equal(detectMediaType('application/zip'), null);

  assert.equal(maxBytesForMediaType('PHOTO'), 8 * 1024 * 1024);
  assert.equal(maxBytesForMediaType('VIDEO'), 100 * 1024 * 1024);
  assert.equal(maxBytesForMediaType('FILE'), 25 * 1024 * 1024);
});

