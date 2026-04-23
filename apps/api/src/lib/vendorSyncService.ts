import type { InvocationContext } from '@azure/functions';
import type { QueryResult } from './db.js';
import { insertVendorSyncLog, getEstimatedCostForDate } from './vendorSyncRepo.js';
import { syncAzureCosts } from './vendorSyncs/azureCostSync.js';
import { syncTelnyxBilling } from './vendorSyncs/telnyxBillingSync.js';
import { syncGoogleCloudBilling } from './vendorSyncs/googleCloudBillingSync.js';
import { logInfo, logWarn } from './serverLogger.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type VendorSyncSummary = {
  date: string;
  azure: { status: string; actualCostUsd: number | null };
  telnyx: { status: string; balanceUsd: number | null; messageCount: number | null };
  googleCloud: { status: string; actualCostUsd: number | null; estimatedCostUsd: number | null };
};

export async function runVendorSync(
  db: Queryable,
  billingDate: string,
  context?: InvocationContext
): Promise<VendorSyncSummary> {
  const [geminiEstimate, telnyxEstimate] = await Promise.all([
    getEstimatedCostForDate(db, billingDate, 'GEMINI_AI'),
    getEstimatedCostForDate(db, billingDate, 'TELNYX_SMS'),
  ]);

  const [azureSettled, telnyxSettled, googleSettled] = await Promise.allSettled([
    syncAzureCosts(billingDate),
    syncTelnyxBilling(billingDate),
    syncGoogleCloudBilling(billingDate, geminiEstimate),
  ]);

  // --- Azure ---
  const azureResult =
    azureSettled.status === 'fulfilled'
      ? azureSettled.value
      : {
          status: 'FAILED' as const,
          actualCostUsd: null,
          currency: 'USD',
          authMethod: null,
          errorMessage: azureSettled.reason instanceof Error ? azureSettled.reason.message : String(azureSettled.reason),
          rawData: null,
        };

  await insertVendorSyncLog(db, {
    vendor: 'AZURE',
    billingDate,
    status: azureResult.status,
    actualCostUsd: azureResult.actualCostUsd,
    estimatedCostUsd: null,
    currency: azureResult.currency ?? 'USD',
    errorMessage: azureResult.errorMessage,
    rawData: azureResult.rawData,
  });

  if (azureResult.status === 'SUCCESS') {
    if (context) logInfo(context, 'vendorSync.azure.success', { date: billingDate, actualCostUsd: azureResult.actualCostUsd, authMethod: azureResult.authMethod });
  } else if (azureResult.status === 'NO_CREDENTIALS') {
    if (context) logInfo(context, 'vendorSync.azure.no_credentials', { date: billingDate });
  } else {
    if (context) logWarn(context, 'vendorSync.azure.failed', { date: billingDate, error: azureResult.errorMessage });
  }

  // --- Telnyx ---
  const telnyxResult =
    telnyxSettled.status === 'fulfilled'
      ? telnyxSettled.value
      : {
          status: 'FAILED' as const,
          balanceUsd: null,
          availableCreditUsd: null,
          messageCount: null,
          errorMessage: telnyxSettled.reason instanceof Error ? telnyxSettled.reason.message : String(telnyxSettled.reason),
          rawData: null,
        };

  await insertVendorSyncLog(db, {
    vendor: 'TELNYX',
    billingDate,
    status: telnyxResult.status,
    actualCostUsd: null, // balance snapshot is not a per-day cost figure
    estimatedCostUsd: telnyxEstimate,
    currency: 'USD',
    errorMessage: telnyxResult.errorMessage,
    rawData: telnyxResult.rawData,
  });

  if (telnyxResult.status === 'SUCCESS') {
    if (context) logInfo(context, 'vendorSync.telnyx.success', { date: billingDate, balanceUsd: telnyxResult.balanceUsd, messageCount: telnyxResult.messageCount });
  } else if (telnyxResult.status === 'NO_CREDENTIALS') {
    if (context) logInfo(context, 'vendorSync.telnyx.no_credentials', { date: billingDate });
  } else {
    if (context) logWarn(context, 'vendorSync.telnyx.failed', { date: billingDate, error: telnyxResult.errorMessage });
  }

  // --- Google Cloud ---
  const googleResult =
    googleSettled.status === 'fulfilled'
      ? googleSettled.value
      : {
          status: 'FAILED' as const,
          actualCostUsd: null,
          estimatedCostUsd: geminiEstimate,
          errorMessage: googleSettled.reason instanceof Error ? googleSettled.reason.message : String(googleSettled.reason),
          rawData: null,
        };

  await insertVendorSyncLog(db, {
    vendor: 'GOOGLE_CLOUD',
    billingDate,
    status: googleResult.status,
    actualCostUsd: googleResult.actualCostUsd,
    estimatedCostUsd: googleResult.estimatedCostUsd,
    currency: 'USD',
    errorMessage: googleResult.errorMessage,
    rawData: googleResult.rawData,
  });

  if (googleResult.status === 'SUCCESS' || googleResult.status === 'ESTIMATED') {
    if (context) logInfo(context, 'vendorSync.google.complete', { date: billingDate, status: googleResult.status, estimatedCostUsd: googleResult.estimatedCostUsd });
  } else if (googleResult.status === 'NO_CREDENTIALS') {
    if (context) logInfo(context, 'vendorSync.google.no_credentials', { date: billingDate });
  } else {
    if (context) logWarn(context, 'vendorSync.google.failed', { date: billingDate, error: googleResult.errorMessage });
  }

  return {
    date: billingDate,
    azure: { status: azureResult.status, actualCostUsd: azureResult.actualCostUsd },
    telnyx: { status: telnyxResult.status, balanceUsd: telnyxResult.balanceUsd ?? null, messageCount: telnyxResult.messageCount ?? null },
    googleCloud: { status: googleResult.status, actualCostUsd: googleResult.actualCostUsd, estimatedCostUsd: googleResult.estimatedCostUsd ?? null },
  };
}
