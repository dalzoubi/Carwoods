const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

export class TelnyxNotConfiguredError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'TelnyxNotConfiguredError';
  }
}

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) throw new TelnyxNotConfiguredError('TELNYX_API_KEY not configured');
  return key;
}

async function parseError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { errors?: Array<{ detail?: string; title?: string }> };
    const first = json.errors?.[0];
    if (first?.detail) return first.detail;
    if (first?.title) return first.title;
  } catch {
    // fall through
  }
  return `telnyx_http_${res.status}`;
}

export async function sendTelnyxEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<string | null> {
  const apiKey = getApiKey();
  const from = process.env.TELNYX_EMAIL_FROM?.trim();
  if (!from) throw new TelnyxNotConfiguredError('TELNYX_EMAIL_FROM not configured');

  const res = await fetch(`${TELNYX_API_BASE}/emails`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));

  const body = (await res.json()) as { data?: { id?: string } };
  return body.data?.id ?? null;
}

export async function sendTelnyxSms(params: {
  to: string;
  text: string;
}): Promise<string | null> {
  const apiKey = getApiKey();
  const from = process.env.TELNYX_SMS_FROM?.trim();
  if (!from) throw new TelnyxNotConfiguredError('TELNYX_SMS_FROM not configured');

  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID?.trim() || undefined;

  const res = await fetch(`${TELNYX_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: params.to,
      text: params.text,
      ...(messagingProfileId ? { messaging_profile_id: messagingProfileId } : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));

  const body = (await res.json()) as { data?: { id?: string } };
  return body.data?.id ?? null;
}

export function telnyxChannelsEnabled(): { email: boolean; sms: boolean } {
  const raw = (process.env.TELNYX_CHANNELS ?? 'email').trim().toLowerCase();
  if (raw === 'both') return { email: true, sms: true };
  if (raw === 'sms') return { email: false, sms: true };
  return { email: true, sms: false };
}
