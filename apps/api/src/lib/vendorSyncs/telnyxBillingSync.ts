const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

export type TelnyxBillingSyncResult = {
  status: 'SUCCESS' | 'FAILED' | 'NO_CREDENTIALS';
  balanceUsd: number | null;
  availableCreditUsd: number | null;
  messageCount: number | null;
  errorMessage: string | null;
  rawData: string | null;
};

type BalanceResponse = {
  data?: {
    balance?: string;
    available_credit?: string;
    currency?: string;
  };
};

type MessagesResponse = {
  meta?: {
    total_results?: number;
  };
};

export async function syncTelnyxBilling(billingDate: string): Promise<TelnyxBillingSyncResult> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) {
    return { status: 'NO_CREDENTIALS', balanceUsd: null, availableCreditUsd: null, messageCount: null, errorMessage: null, rawData: null };
  }

  const authHeader = `Bearer ${apiKey}`;

  try {
    const [balanceRes, messagesRes] = await Promise.all([
      fetch(`${TELNYX_API_BASE}/balance`, {
        headers: { Authorization: authHeader },
      }),
      fetch(
        `${TELNYX_API_BASE}/messages` +
          `?filter[created_at][gte]=${billingDate}T00:00:00Z` +
          `&filter[created_at][lte]=${billingDate}T23:59:59Z` +
          `&page[size]=1`,
        { headers: { Authorization: authHeader } }
      ),
    ]);

    if (!balanceRes.ok) {
      return {
        status: 'FAILED',
        balanceUsd: null,
        availableCreditUsd: null,
        messageCount: null,
        errorMessage: `Telnyx balance endpoint returned HTTP ${balanceRes.status}`,
        rawData: null,
      };
    }

    const balanceBody = (await balanceRes.json()) as BalanceResponse;
    const balanceUsd = parseFloat(balanceBody.data?.balance ?? '0') || null;
    const availableCreditUsd = parseFloat(balanceBody.data?.available_credit ?? '0') || null;

    let messageCount: number | null = null;
    if (messagesRes.ok) {
      const msgBody = (await messagesRes.json()) as MessagesResponse;
      messageCount = msgBody.meta?.total_results ?? null;
    }

    return {
      status: 'SUCCESS',
      balanceUsd,
      availableCreditUsd,
      messageCount,
      errorMessage: null,
      rawData: JSON.stringify({
        balance: balanceBody.data,
        messages_total: messageCount,
        billing_date: billingDate,
      }),
    };
  } catch (err) {
    return {
      status: 'FAILED',
      balanceUsd: null,
      availableCreditUsd: null,
      messageCount: null,
      errorMessage: err instanceof Error ? err.message : String(err),
      rawData: null,
    };
  }
}
