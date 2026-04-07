export const Role = {
  ADMIN: 'ADMIN',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
} as const;

export type Role = typeof Role[keyof typeof Role];

/** Returns true when the given role string has management (landlord/admin) access. */
export function hasLandlordAccess(role: string): boolean {
  const r = role.trim().toUpperCase();
  return r === Role.ADMIN || r === Role.LANDLORD;
}
