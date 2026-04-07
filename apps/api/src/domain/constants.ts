export const Role = {
  ADMIN: 'ADMIN',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
} as const;

export type Role = typeof Role[keyof typeof Role];

export const RequestStatus = {
  NOT_STARTED: 'NOT_STARTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  SCHEDULED: 'SCHEDULED',
  WAITING_ON_TENANT: 'WAITING_ON_TENANT',
  WAITING_ON_VENDOR: 'WAITING_ON_VENDOR',
  COMPLETE: 'COMPLETE',
  CANCELLED: 'CANCELLED',
} as const;

export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];

/** Returns true when the given role string has management (landlord/admin) access. */
export function hasLandlordAccess(role: string): boolean {
  const r = role.trim().toUpperCase();
  return r === Role.ADMIN || r === Role.LANDLORD;
}
