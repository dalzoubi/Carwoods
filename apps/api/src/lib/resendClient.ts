const RESEND_API_BASE = 'https://api.resend.com';

export class ResendNotConfiguredError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ResendNotConfiguredError';
  }
}

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new ResendNotConfiguredError('RESEND_API_KEY not configured');
  return key;
}

async function parseError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { message?: string; error?: string; name?: string };
    if (json.message) return json.message;
    if (json.error) return json.error;
    if (json.name) return json.name;
  } catch {
    // fall through
  }
  return `resend_http_${res.status}`;
}

export async function sendResendEmail(params: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<string | null> {
  const apiKey = getApiKey();
  const from = process.env.RESEND_EMAIL_FROM?.trim();
  if (!from) throw new ResendNotConfiguredError('RESEND_EMAIL_FROM not configured');

  const body: Record<string, unknown> = {
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
  };
  if (params.replyTo) body.reply_to = params.replyTo;

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await parseError(res));

  const body = (await res.json()) as { id?: string };
  return body.id ?? null;
}
