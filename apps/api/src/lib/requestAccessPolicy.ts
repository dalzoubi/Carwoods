import { Role } from '../domain/constants.js';

export type PortalRole = 'ADMIN' | 'LANDLORD' | 'TENANT';

export function canViewInternalMessages(role: PortalRole): boolean {
  return role === Role.ADMIN || role === Role.LANDLORD;
}

export function canPostInternalMessages(role: PortalRole): boolean {
  return role === Role.ADMIN || role === Role.LANDLORD;
}

export function canCreateMaintenanceRequest(role: PortalRole): boolean {
  return role === Role.TENANT;
}

