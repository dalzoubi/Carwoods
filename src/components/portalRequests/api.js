import { Role } from '../../domain/constants.js';

export function endpoint(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function normalizedRole(rawRole) {
  const value = String(rawRole ?? '').trim().toUpperCase();
  if (value === Role.ADMIN) return Role.ADMIN;
  if (value === Role.LANDLORD) return Role.LANDLORD;
  if (value === Role.TENANT) return Role.TENANT;
  return 'GUEST';
}

export async function parseErrorResponse(res) {
  let detail = `HTTP ${res.status}`;
  try {
    const payload = await res.json();
    if (payload && typeof payload.error === 'string') {
      detail = `${detail} (${payload.error})`;
    }
  } catch {
    // best effort parse
  }
  return detail;
}

