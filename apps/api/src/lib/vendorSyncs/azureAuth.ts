const IMDS_URL =
  'http://169.254.169.254/metadata/identity/oauth2/token' +
  '?api-version=2018-02-01&resource=https%3A%2F%2Fmanagement.azure.com%2F';

const SP_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;

export class AzureAuthNotConfiguredError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AzureAuthNotConfiguredError';
  }
}

type TokenResponse = { access_token?: string };

async function tryManagedIdentity(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(IMDS_URL, {
      headers: { Metadata: 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as TokenResponse;
    return body.access_token ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getServicePrincipalToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();

  if (!tenantId || !clientId || !clientSecret) {
    throw new AzureAuthNotConfiguredError(
      'AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET are all required for service principal auth'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
  });

  const res = await fetch(SP_TOKEN_URL(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Azure SP token request failed: HTTP ${res.status}`);
  }

  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new Error('Azure SP token response missing access_token');
  }
  return json.access_token;
}

/**
 * Returns a bearer token for the Azure Management API.
 * Tries managed identity (IMDS) first; falls back to service principal credentials.
 */
export async function getAzureManagementToken(): Promise<{ token: string; method: string }> {
  const miToken = await tryManagedIdentity();
  if (miToken) {
    return { token: miToken, method: 'managed_identity' };
  }
  const spToken = await getServicePrincipalToken();
  return { token: spToken, method: 'service_principal' };
}
