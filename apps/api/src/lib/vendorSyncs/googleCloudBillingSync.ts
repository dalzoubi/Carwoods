import { SignJWT, importPKCS8 } from 'jose';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLOUD_BILLING_SCOPE = 'https://www.googleapis.com/auth/cloud-billing.readonly';

export type GoogleCloudBillingSyncResult = {
  status: 'SUCCESS' | 'FAILED' | 'NO_CREDENTIALS' | 'ESTIMATED';
  actualCostUsd: number | null;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
  rawData: string | null;
};

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type AccessTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type BillingAccountResponse = {
  name?: string;
  displayName?: string;
  open?: boolean;
};

async function getGoogleAccessToken(keyJson: ServiceAccountKey): Promise<string> {
  const privateKey = await importPKCS8(keyJson.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = keyJson.token_uri ?? GOOGLE_TOKEN_URL;

  const assertion = await new SignJWT({ scope: CLOUD_BILLING_SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(keyJson.client_email)
    .setSubject(keyJson.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await res.json()) as AccessTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google token exchange failed: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`
    );
  }
  return json.access_token;
}

/**
 * Syncs Google Cloud billing data for the given date.
 *
 * The Cloud Billing REST API only provides account-level metadata — granular
 * per-day spend requires BigQuery billing export, which is not guaranteed to be
 * configured. This function verifies credentials are valid (by fetching account
 * info) and returns ESTIMATED with the Phase 2 rolled-up amount as a stand-in
 * until BigQuery export is available.
 */
export async function syncGoogleCloudBilling(
  billingDate: string,
  estimatedCostUsd: number
): Promise<GoogleCloudBillingSyncResult> {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64?.trim();
  const billingAccountId = process.env.GOOGLE_CLOUD_BILLING_ACCOUNT_ID?.trim();

  if (!keyB64 || !billingAccountId) {
    return { status: 'NO_CREDENTIALS', actualCostUsd: null, estimatedCostUsd, errorMessage: null, rawData: null };
  }

  try {
    const keyJson = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf8')) as ServiceAccountKey;
    const accessToken = await getGoogleAccessToken(keyJson);

    const normalizedId = billingAccountId.startsWith('billingAccounts/')
      ? billingAccountId
      : `billingAccounts/${billingAccountId}`;
    const accountUrl = `https://cloudbilling.googleapis.com/v1/${normalizedId}`;
    const res = await fetch(accountUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return {
        status: 'FAILED',
        actualCostUsd: null,
        estimatedCostUsd,
        errorMessage: `Cloud Billing API returned HTTP ${res.status}`,
        rawData: null,
      };
    }

    const accountInfo = (await res.json()) as BillingAccountResponse;

    // The REST API does not expose daily cost data — that requires BigQuery export.
    // Return ESTIMATED with the Phase 2 rolled-up total as the best available figure.
    return {
      status: 'ESTIMATED',
      actualCostUsd: null,
      estimatedCostUsd,
      errorMessage: null,
      rawData: JSON.stringify({
        billing_date: billingDate,
        account_name: accountInfo.name,
        account_display_name: accountInfo.displayName,
        account_open: accountInfo.open,
        note: 'daily_cost_requires_bigquery_export',
      }),
    };
  } catch (err) {
    return {
      status: 'FAILED',
      actualCostUsd: null,
      estimatedCostUsd,
      errorMessage: err instanceof Error ? err.message : String(err),
      rawData: null,
    };
  }
}
