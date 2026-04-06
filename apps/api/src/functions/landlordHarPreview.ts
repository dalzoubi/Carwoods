import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { requireLandlordOrAdmin, jsonResponse } from '../lib/managementRequest.js';
import { fetchHarListingTile } from '../lib/harListingFetch.js';
import { logInfo, logWarn } from '../lib/serverLogger.js';

async function landlordHarPreviewHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const gate = await requireLandlordOrAdmin(request, context);
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const rawId = request.query.get('id') ?? '';
  const id = rawId.trim();
  if (!id) {
    logWarn(context, 'har_preview.missing_id', { userId: ctx.user.id });
    return jsonResponse(400, ctx.headers, { error: 'missing_id' });
  }

  logInfo(context, 'har_preview.start', { userId: ctx.user.id, id });
  try {
    const tile = await fetchHarListingTile(id);
    logInfo(context, 'har_preview.success', { userId: ctx.user.id, id });
    return jsonResponse(200, ctx.headers, { listing: tile });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'fetch_failed';
    logWarn(context, 'har_preview.failed', { userId: ctx.user.id, id, message });
    if (
      message.includes('HTTP 4') ||
      message.includes('not found') ||
      message.includes('could not parse')
    ) {
      return jsonResponse(404, ctx.headers, { error: 'listing_not_found', message });
    }
    return jsonResponse(502, ctx.headers, { error: 'har_unreachable', message });
  }
}

app.http('landlordHarPreview', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'landlord/har-preview',
  handler: landlordHarPreviewHandler,
});
