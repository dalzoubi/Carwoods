/**
 * Client-side storage for landlord-managed properties (onboarded via the portal).
 * Uses localStorage so properties persist across sessions without a backend.
 *
 * Each property record shape:
 * {
 *   id: string,           // "portal-<uuid>"
 *   harId: string,        // HAR listing ID (if looked up), or ""
 *   addressLine: string,
 *   cityStateZip: string,
 *   monthlyRentLabel: string,
 *   photoUrl: string,     // external URL or base64 data URL
 *   harListingUrl: string,
 *   applyUrl: string,
 *   detailLines: string[],
 *   showOnApplyPage: boolean,
 *   createdAt: string,    // ISO timestamp
 *   updatedAt: string,    // ISO timestamp
 * }
 */

const STORAGE_KEY = 'carwoods_portal_properties';

function generateId() {
  return `portal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

export function loadProperties() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProperties(properties) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
  } catch {
    // quota exceeded or private browsing — fail silently
  }
}

export function addProperty(data) {
  const ts = now();
  const record = {
    id: generateId(),
    harId: data.harId ?? '',
    addressLine: data.addressLine ?? '',
    cityStateZip: data.cityStateZip ?? '',
    monthlyRentLabel: data.monthlyRentLabel ?? '',
    photoUrl: data.photoUrl ?? '',
    harListingUrl: data.harListingUrl ?? '',
    applyUrl: data.applyUrl ?? '',
    detailLines: Array.isArray(data.detailLines) ? data.detailLines : [],
    showOnApplyPage: Boolean(data.showOnApplyPage),
    createdAt: ts,
    updatedAt: ts,
  };
  const properties = loadProperties();
  properties.push(record);
  saveProperties(properties);
  return record;
}

export function updateProperty(id, patch) {
  const properties = loadProperties();
  const idx = properties.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated = { ...properties[idx], ...patch, id, updatedAt: now() };
  properties[idx] = updated;
  saveProperties(properties);
  return updated;
}

export function deleteProperty(id) {
  const properties = loadProperties();
  const next = properties.filter((p) => p.id !== id);
  saveProperties(next);
}

/** Returns only properties flagged to show on the apply page. */
export function loadPublicProperties() {
  return loadProperties().filter((p) => p.showOnApplyPage);
}
