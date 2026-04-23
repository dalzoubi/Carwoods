import { AzureAuthNotConfiguredError, getAzureManagementToken } from './azureAuth.js';

const COST_MANAGEMENT_URL = (subscriptionId: string) =>
  `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}` +
  `/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

export type AzureCostSyncResult = {
  status: 'SUCCESS' | 'FAILED' | 'NO_CREDENTIALS';
  actualCostUsd: number | null;
  currency: string;
  authMethod: string | null;
  errorMessage: string | null;
  rawData: string | null;
};

type CostManagementResponse = {
  properties?: {
    columns?: Array<{ name: string; type: string }>;
    rows?: Array<unknown[]>;
    currency?: string;
  };
};

function sumCostColumn(response: CostManagementResponse): { total: number; currency: string } {
  const columns = response.properties?.columns ?? [];
  const rows = response.properties?.rows ?? [];
  const currency = response.properties?.currency ?? 'USD';

  const costIdx = columns.findIndex(
    (c) => c.name.toLowerCase() === 'cost' || c.name.toLowerCase() === 'pretaxcost'
  );
  if (costIdx === -1) return { total: 0, currency };

  const total = rows.reduce((sum, row) => {
    const val = row[costIdx];
    return sum + (typeof val === 'number' ? val : parseFloat(String(val ?? 0)) || 0);
  }, 0);

  return { total, currency };
}

export async function syncAzureCosts(billingDate: string): Promise<AzureCostSyncResult> {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID?.trim();
  if (!subscriptionId) {
    return { status: 'NO_CREDENTIALS', actualCostUsd: null, currency: 'USD', authMethod: null, errorMessage: null, rawData: null };
  }

  let authMethod: string | null = null;
  try {
    const { token, method } = await getAzureManagementToken();
    authMethod = method;

    const resourceGroup = process.env.AZURE_RESOURCE_GROUP?.trim() ?? 'carwoods.com';
    const requestBody = {
      type: 'ActualCost',
      timeframe: 'Custom',
      timePeriod: {
        from: `${billingDate}T00:00:00Z`,
        to: `${billingDate}T23:59:59Z`,
      },
      dataset: {
        granularity: 'Daily',
        filter: {
          dimensions: {
            name: 'ResourceGroupName',
            operator: 'In',
            values: [resourceGroup],
          },
        },
        aggregation: {
          totalCost: { name: 'Cost', function: 'Sum' },
        },
        grouping: [{ type: 'Dimension', name: 'ResourceId' }],
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(COST_MANAGEMENT_URL(subscriptionId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      return {
        status: 'FAILED',
        actualCostUsd: null,
        currency: 'USD',
        authMethod,
        errorMessage: `Azure Cost Management returned HTTP ${res.status}`,
        rawData: null,
      };
    }

    const payload = (await res.json()) as CostManagementResponse;
    const { total, currency } = sumCostColumn(payload);

    return {
      status: 'SUCCESS',
      actualCostUsd: total,
      currency,
      authMethod,
      errorMessage: null,
      rawData: JSON.stringify(payload),
    };
  } catch (err) {
    if (err instanceof AzureAuthNotConfiguredError) {
      return { status: 'NO_CREDENTIALS', actualCostUsd: null, currency: 'USD', authMethod: null, errorMessage: null, rawData: null };
    }
    return {
      status: 'FAILED',
      actualCostUsd: null,
      currency: 'USD',
      authMethod,
      errorMessage: err instanceof Error ? err.message : String(err),
      rawData: null,
    };
  }
}
