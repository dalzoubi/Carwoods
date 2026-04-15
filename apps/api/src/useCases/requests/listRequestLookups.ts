/**
 * Return lookup data needed by the create-request form.
 *
 * Tenants also receive their active-lease defaults and landlord contact.
 * Landlords / admins receive categories and priorities only.
 */

import {
  findTenantLandlordContact,
  findTenantRequestDefaults,
  listActiveRequestPriorities,
  listActiveServiceCategories,
  type RequestLookupOption,
  type TenantLandlordContact,
  type TenantRequestDefaults,
} from '../../lib/requestsRepo.js';
import { forbidden } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { Queryable } from '../types.js';
import {
  getTierLimitsForPropertyId,
  tierLimitsToSubscriptionFeatures,
  type SubscriptionFeaturesPayload,
} from '../../lib/subscriptionTierCapabilities.js';
import { getTierByName } from '../../lib/subscriptionTiersRepo.js';

export type ListRequestLookupsInput = {
  actorUserId: string;
  actorRole: string;
};

export type ListRequestLookupsOutput = {
  categories: RequestLookupOption[];
  priorities: RequestLookupOption[];
  tenant_defaults: TenantRequestDefaults | null;
  landlord_contact: TenantLandlordContact | null;
  subscription_features: SubscriptionFeaturesPayload | null;
};

export async function listRequestLookups(
  db: Queryable,
  input: ListRequestLookupsInput
): Promise<ListRequestLookupsOutput> {
  const role = input.actorRole.trim().toUpperCase();

  if (role !== Role.TENANT && role !== Role.LANDLORD && role !== Role.ADMIN) {
    throw forbidden();
  }

  const [categories, priorities] = await Promise.all([
    listActiveServiceCategories(db),
    listActiveRequestPriorities(db),
  ]);

  let tenant_defaults: TenantRequestDefaults | null = null;
  let landlord_contact: TenantLandlordContact | null = null;

  if (role === Role.TENANT) {
    [tenant_defaults, landlord_contact] = await Promise.all([
      findTenantRequestDefaults(db, input.actorUserId),
      findTenantLandlordContact(db, input.actorUserId),
    ]);
  }

  let subscription_features: SubscriptionFeaturesPayload | null = null;
  if (role === Role.TENANT && tenant_defaults?.property_id) {
    let lim = await getTierLimitsForPropertyId(db, tenant_defaults.property_id);
    if (!lim) {
      const free = await getTierByName(db, 'FREE');
      lim = free?.limits ?? null;
    }
    if (lim) subscription_features = tierLimitsToSubscriptionFeatures(lim);
  }

  return { categories, priorities, tenant_defaults, landlord_contact, subscription_features };
}
