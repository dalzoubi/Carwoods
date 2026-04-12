import { describe, expect, it } from 'vitest';
import { mergePolledRequestMessages } from './mergePolledRequestMessages.js';

describe('mergePolledRequestMessages', () => {
  it('preserves prior sender_profile_photo_url when blob path matches', () => {
    const prevUrl = 'https://acct.blob.core.windows.net/c/x/y.jpg?sv=2021&sig=aaa';
    const nextUrl = 'https://acct.blob.core.windows.net/c/x/y.jpg?sv=2021&sig=bbb';
    const prev = [
      {
        id: 'm1',
        sender_user_id: 'u1',
        sender_profile_photo_url: prevUrl,
        body: 'hi',
      },
    ];
    const next = [
      {
        id: 'm1',
        sender_user_id: 'u1',
        sender_profile_photo_url: nextUrl,
        body: 'hi',
      },
    ];
    const out = mergePolledRequestMessages(prev, next);
    expect(out[0].sender_profile_photo_url).toBe(prevUrl);
  });

  it('uses new URL when blob path changes', () => {
    const prevUrl = 'https://acct.blob.core.windows.net/c/old.jpg?sig=1';
    const nextUrl = 'https://acct.blob.core.windows.net/c/new.jpg?sig=2';
    const prev = [{ id: 'm1', sender_user_id: 'u1', sender_profile_photo_url: prevUrl }];
    const next = [{ id: 'm1', sender_user_id: 'u1', sender_profile_photo_url: nextUrl }];
    const out = mergePolledRequestMessages(prev, next);
    expect(out[0].sender_profile_photo_url).toBe(nextUrl);
  });
});
