/**
 * Shared domain constants and types (no framework imports).
 */

export const UserRole = {
  ADMIN: 'ADMIN',
  TENANT: 'TENANT',
  VENDOR: 'VENDOR',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  DISABLED: 'DISABLED',
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];

export const ListingSource = {
  MANUAL: 'MANUAL',
  HAR_SYNC: 'HAR_SYNC',
  OTHER: 'OTHER',
} as const;

export type ListingSourceType = (typeof ListingSource)[keyof typeof ListingSource];

/** Normalized apply tile for public API (no PII). */
export type PublicApplyProperty = {
  id: string;
  addressLine: string;
  cityStateZip: string;
  monthlyRentLabel: string;
  photoUrl: string;
  harListingUrl: string;
  applyUrl: string;
  detailLines: string[];
};
