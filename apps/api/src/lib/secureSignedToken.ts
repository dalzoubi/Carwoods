import crypto from 'node:crypto';

const ATTACHMENT_KIND = 'att1';
const EMAIL_REPLY_KIND = 'er1';

function signingSecret(): string {
  const s = process.env.PORTAL_LINK_SIGNING_SECRET?.trim();
  if (s && s.length >= 16) return s;
  const fb = process.env.NOTIFICATION_LINK_SIGNING_SECRET?.trim();
  if (fb && fb.length >= 16) return fb;
  return 'dev-only-insecure-portal-link-secret';
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function signPayload(payloadJson: string): string {
  const mac = crypto.createHmac('sha256', signingSecret()).update(payloadJson).digest('base64url');
  const payloadB64 = Buffer.from(payloadJson, 'utf8').toString('base64url');
  return `${payloadB64}.${mac}`;
}

function verifySignedPayload<T extends Record<string, unknown>>(
  token: string,
  kind: string
): (T & { exp: number }) | null {
  const trimmed = token.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = trimmed.slice(0, dot);
  const mac = trimmed.slice(dot + 1);
  let payloadJson: string;
  try {
    payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expectedMac = crypto.createHmac('sha256', signingSecret()).update(payloadJson).digest('base64url');
  if (!timingSafeEqual(mac, expectedMac)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (o.k !== kind) return null;
  const exp = typeof o.exp === 'number' && Number.isFinite(o.exp) ? o.exp : NaN;
  if (!Number.isFinite(exp)) return null;
  if (exp * 1000 < Date.now()) return null;
  return o as T & { exp: number };
}

export type AttachmentAccessTokenPayload = {
  k: typeof ATTACHMENT_KIND;
  r: string;
  a: string;
  exp: number;
};

export function signAttachmentAccessToken(params: {
  requestId: string;
  attachmentId: string;
  expiresAtEpochSec: number;
}): string {
  const payloadJson = JSON.stringify({
    k: ATTACHMENT_KIND,
    r: params.requestId,
    a: params.attachmentId,
    exp: params.expiresAtEpochSec,
  });
  return signPayload(payloadJson);
}

export function verifyAttachmentAccessToken(token: string): { requestId: string; attachmentId: string } | null {
  const v = verifySignedPayload<AttachmentAccessTokenPayload>(token, ATTACHMENT_KIND);
  if (!v || typeof v.r !== 'string' || typeof v.a !== 'string') return null;
  return { requestId: v.r, attachmentId: v.a };
}

export type EmailReplyTokenPayload = {
  k: typeof EMAIL_REPLY_KIND;
  r: string;
  u: string;
  exp: number;
};

export function signEmailReplyToken(params: {
  requestId: string;
  userId: string;
  expiresAtEpochSec: number;
}): string {
  const payloadJson = JSON.stringify({
    k: EMAIL_REPLY_KIND,
    r: params.requestId,
    u: params.userId,
    exp: params.expiresAtEpochSec,
  });
  return signPayload(payloadJson);
}

export function verifyEmailReplyToken(token: string): { requestId: string; userId: string } | null {
  const v = verifySignedPayload<EmailReplyTokenPayload>(token, EMAIL_REPLY_KIND);
  if (!v || typeof v.r !== 'string' || typeof v.u !== 'string') return null;
  return { requestId: v.r, userId: v.u };
}

/** Local-part suffix after prefix (e.g. cwreply+TOKEN → TOKEN). */
export function extractTokenFromRecipientAddress(toAddress: string, localPrefix: string): string | null {
  const trimmed = toAddress.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const prefixLower = `${localPrefix.toLowerCase()}+`;
  if (local.toLowerCase().slice(0, prefixLower.length) !== prefixLower) return null;
  // Token portion preserves original case — base64url payload is case-sensitive.
  const token = local.slice(prefixLower.length).trim();
  return token || null;
}
