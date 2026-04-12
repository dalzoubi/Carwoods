import test from 'node:test';
import assert from 'node:assert/strict';
import { weakEtagForJsonPayload, requestIfNoneMatchMatches } from '../dist/src/lib/httpEtag.js';

test('weakEtagForJsonPayload is stable for identical payloads', () => {
  const body = { a: 1, b: 'x' };
  assert.equal(weakEtagForJsonPayload(body), weakEtagForJsonPayload({ a: 1, b: 'x' }));
});

test('requestIfNoneMatchMatches accepts exact etag token', () => {
  const etag = weakEtagForJsonPayload({ ok: true });
  assert.equal(requestIfNoneMatchMatches(etag, etag), true);
});

test('requestIfNoneMatchMatches accepts *', () => {
  const etag = weakEtagForJsonPayload({});
  assert.equal(requestIfNoneMatchMatches('*', etag), true);
});
