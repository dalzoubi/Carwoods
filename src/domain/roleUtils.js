import { Role } from './constants.js';

export function hasLandlordAccess(role) {
  const normalized = String(role ?? '').toUpperCase();
  return normalized === Role.LANDLORD || normalized === Role.ADMIN;
}
