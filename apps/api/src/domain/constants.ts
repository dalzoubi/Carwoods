export const Role = {
  ADMIN: 'ADMIN',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
  AI_AGENT: 'AI_AGENT',
} as const;

export const RequestStatus = {
  NOT_STARTED: 'NOT_STARTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  SCHEDULED: 'SCHEDULED',
  WAITING_ON_TENANT: 'WAITING_ON_TENANT',
  WAITING_ON_VENDOR: 'WAITING_ON_VENDOR',
  COMPLETE: 'COMPLETE',
  CANCELLED: 'CANCELLED',
} as const;

export type Role = typeof Role[keyof typeof Role];

/** Returns true when the given role string has management (landlord/admin) access. */
export function hasLandlordAccess(role: string): boolean {
  const r = role.trim().toUpperCase();
  return r === Role.ADMIN || r === Role.LANDLORD;
}

/** Returns true for Elsa/system automation roles. */
export function hasAiAgentAccess(role: string): boolean {
  return role.trim().toUpperCase() === Role.AI_AGENT;
}
