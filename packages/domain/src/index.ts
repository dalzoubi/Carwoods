/**
 * Shared domain constants and types (no framework imports).
 */

export const UserRole = {
  ADMIN: 'ADMIN',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

/**
 * Canonical role constants shared by frontend + API.
 * Kept in sync with UserRole for backwards compatibility.
 */
export const Role = UserRole;
export type Role = UserRoleType;

export const RequestStatus = {
  OPEN: 'OPEN',
  NOT_STARTED: 'NOT_STARTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  CANCELLED: 'CANCELLED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

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
