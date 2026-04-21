import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSmsHelpKeyword,
  isSmsStopKeyword,
  SMS_HELP_REPLY,
  SMS_STOP_REPLY,
  SMS_OPT_IN_VERSION,
  SMS_OPT_IN_SOURCE_WEB_PORTAL,
  SMS_OPT_IN_DISCLOSURE,
} from '../dist/src/domain/smsConsent.js';
import { parseInboundSmsPayload } from '../dist/src/functions/inboundSmsWebhook.js';

test('STOP variants all opt the user out', () => {
  for (const kw of ['STOP', 'stop', ' Stop ', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']) {
    assert.equal(isSmsStopKeyword(kw), true, `expected STOP for ${JSON.stringify(kw)}`);
    assert.equal(isSmsHelpKeyword(kw), false);
  }
});

test('HELP variants trigger help reply, not opt-out', () => {
  for (const kw of ['HELP', 'help', ' Help ', 'INFO']) {
    assert.equal(isSmsHelpKeyword(kw), true, `expected HELP for ${JSON.stringify(kw)}`);
    assert.equal(isSmsStopKeyword(kw), false);
  }
});

test('non-keywords are neither HELP nor STOP', () => {
  for (const kw of ['hi', 'maintenance', 'yes', '', '123']) {
    assert.equal(isSmsStopKeyword(kw), false);
    assert.equal(isSmsHelpKeyword(kw), false);
  }
});

test('SMS disclosure and auto-replies carry the required branding + disclosures', () => {
  assert.ok(SMS_OPT_IN_DISCLOSURE.includes('Carwoods'));
  assert.ok(SMS_OPT_IN_DISCLOSURE.includes('Message frequency varies'));
  assert.ok(SMS_OPT_IN_DISCLOSURE.includes('Message and data rates may apply'));
  assert.ok(SMS_OPT_IN_DISCLOSURE.includes('Reply STOP'));
  assert.ok(SMS_OPT_IN_DISCLOSURE.includes('Reply HELP'));
  assert.ok(SMS_OPT_IN_DISCLOSURE.includes('Consent is not a condition of purchase'));

  assert.ok(SMS_HELP_REPLY.startsWith('Carwoods:'));
  assert.ok(SMS_HELP_REPLY.includes('support@carwoods.com'));
  assert.ok(SMS_HELP_REPLY.includes('https://carwoods.com/portal/profile'));
  assert.ok(SMS_HELP_REPLY.includes('Message frequency varies'));
  assert.ok(SMS_HELP_REPLY.includes('Message and data rates may apply'));

  assert.ok(SMS_STOP_REPLY.startsWith('Carwoods:'));
  assert.ok(SMS_STOP_REPLY.includes('opted out'));

  assert.equal(SMS_OPT_IN_SOURCE_WEB_PORTAL, 'WEB_PORTAL_PROFILE');
  assert.ok(/^\d{4}-\d{2}-\d{2}\.v\d+$/.test(SMS_OPT_IN_VERSION));
});

test('parseInboundSmsPayload handles Telnyx v2 wrapped shape', () => {
  const payload = {
    data: {
      payload: {
        from: { phone_number: '+15551234567' },
        to: [{ phone_number: '+18885550000' }],
        text: 'STOP',
      },
    },
  };
  const parsed = parseInboundSmsPayload(payload);
  assert.equal(parsed.from, '+15551234567');
  assert.equal(parsed.to, '+18885550000');
  assert.equal(parsed.text, 'STOP');
});

test('parseInboundSmsPayload handles flat shape', () => {
  const payload = { from: '+15551234567', to: '+18885550000', text: 'HELP' };
  const parsed = parseInboundSmsPayload(payload);
  assert.equal(parsed.from, '+15551234567');
  assert.equal(parsed.to, '+18885550000');
  assert.equal(parsed.text, 'HELP');
});

test('parseInboundSmsPayload returns null fields on empty input', () => {
  const parsed = parseInboundSmsPayload({});
  assert.equal(parsed.from, null);
  assert.equal(parsed.to, null);
  assert.equal(parsed.text, null);
});
