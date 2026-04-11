import test from 'node:test';
import assert from 'node:assert/strict';
import { isProfilePhotoPathForUser } from '../dist/src/useCases/users/profilePhoto.js';

const uid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test('isProfilePhotoPathForUser accepts valid path', () => {
  assert.equal(
    isProfilePhotoPathForUser(
      `profile-photos/${uid}/f1e2d3c4-b5a6-7890-abcd-ef1234567890.jpg`,
      uid
    ),
    true
  );
});

test('isProfilePhotoPathForUser rejects wrong user segment', () => {
  assert.equal(
    isProfilePhotoPathForUser(
      'profile-photos/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/blob.jpg',
      uid
    ),
    false
  );
});

test('isProfilePhotoPathForUser rejects traversal and depth', () => {
  assert.equal(isProfilePhotoPathForUser(`profile-photos/${uid}/../x.jpg`, uid), false);
  assert.equal(isProfilePhotoPathForUser(`profile-photos/${uid}`, uid), false);
  assert.equal(
    isProfilePhotoPathForUser(`profile-photos/${uid}/a/extra.jpg`, uid),
    false
  );
});

test('isProfilePhotoPathForUser accepts brace-normalized user id', () => {
  assert.equal(
    isProfilePhotoPathForUser(
      `profile-photos/{${uid.toUpperCase()}}/x.png`,
      `{${uid}}`
    ),
    true
  );
});
