export const Role = {
  ADMIN: 'ADMIN',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
} as const;

export type Role = typeof Role[keyof typeof Role];

export const RequestStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];
