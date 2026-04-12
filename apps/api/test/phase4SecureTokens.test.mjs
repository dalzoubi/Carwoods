import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signAttachmentAccessToken,
  verifyAttachmentAccessToken,
  signEmailReplyToken,
  verifyEmailReplyToken,
  extractTokenFromRecipientAddress,
} from '../dist/src/lib/secureSignedToken.js';

test('attachment access token round-trip and expiry', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tok = signAttachmentAccessToken({
    requestId: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
    attachmentId: '63f71e58-0462-4f2b-9aae-9174260df106',
    expiresAtEpochSec: exp,
  });
  const v = verifyAttachmentAccessToken(tok);
  assert.ok(v);
  assert.equal(v.requestId, '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d');
  assert.equal(v.attachmentId, '63f71e58-0462-4f2b-9aae-9174260df106');
});

test('attachment access token rejects tampering', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tok = signAttachmentAccessToken({
    requestId: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
    attachmentId: '63f71e58-0462-4f2b-9aae-9174260df106',
    expiresAtEpochSec: exp,
  });
  const broken = `${tok}x`;
  assert.equal(verifyAttachmentAccessToken(broken), null);
});

test('attachment access token rejects expired', () => {
  const exp = Math.floor(Date.now() / 1000) - 10;
  const tok = signAttachmentAccessToken({
    requestId: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
    attachmentId: '63f71e58-0462-4f2b-9aae-9174260df106',
    expiresAtEpochSec: exp,
  });
  assert.equal(verifyAttachmentAccessToken(tok), null);
});

test('email reply token round-trip', () => {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const tok = signEmailReplyToken({
    requestId: '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d',
    userId: '63f71e58-0462-4f2b-9aae-9174260df106',
    expiresAtEpochSec: exp,
  });
  const v = verifyEmailReplyToken(tok);
  assert.ok(v);
  assert.equal(v.requestId, '3b8ec86f-6ca3-4ec2-b219-8a2da1d6880d');
  assert.equal(v.userId, '63f71e58-0462-4f2b-9aae-9174260df106');
});

test('extractTokenFromRecipientAddress', () => {
  assert.equal(
    extractTokenFromRecipientAddress('cwreply+abc.def@inbound.example.com', 'cwreply'),
    'abc.def'
  );
  assert.equal(extractTokenFromRecipientAddress('other+nope@x.com', 'cwreply'), null);
});
