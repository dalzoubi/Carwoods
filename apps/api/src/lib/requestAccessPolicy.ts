export type PortalRole = 'ADMIN' | 'LANDLORD' | 'TENANT';

export function canViewInternalMessages(role: PortalRole): boolean {
  return role === 'ADMIN' || role === 'LANDLORD';
}

export function canPostInternalMessages(role: PortalRole): boolean {
  return role === 'ADMIN' || role === 'LANDLORD';
}

export function canCreateMaintenanceRequest(role: PortalRole): boolean {
  return role === 'TENANT';
}

