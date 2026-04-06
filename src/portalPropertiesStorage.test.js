import { describe, it, expect, beforeEach } from 'vitest';
import {
  addProperty,
  deleteProperty,
  loadProperties,
  loadPublicProperties,
  saveProperties,
  updateProperty,
} from './portalPropertiesStorage';

describe('portalPropertiesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads empty array when storage is empty', () => {
    expect(loadProperties()).toEqual([]);
  });

  it('adds a property and persists it', () => {
    const record = addProperty({
      addressLine: '1 Test St',
      cityStateZip: 'Houston, TX 77001',
      showOnApplyPage: true,
    });
    expect(record.id).toMatch(/^portal-/);
    expect(record.addressLine).toBe('1 Test St');
    const loaded = loadProperties();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(record.id);
  });

  it('updates a property', () => {
    const record = addProperty({ addressLine: '2 Old St', cityStateZip: 'Houston, TX 77002', showOnApplyPage: false });
    updateProperty(record.id, { addressLine: '2 New St', showOnApplyPage: true });
    const loaded = loadProperties();
    expect(loaded[0].addressLine).toBe('2 New St');
    expect(loaded[0].showOnApplyPage).toBe(true);
  });

  it('deletes a property', () => {
    const a = addProperty({ addressLine: 'A', cityStateZip: 'X' });
    const b = addProperty({ addressLine: 'B', cityStateZip: 'Y' });
    deleteProperty(a.id);
    const loaded = loadProperties();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(b.id);
  });

  it('loadPublicProperties returns only showOnApplyPage=true records', () => {
    addProperty({ addressLine: 'Public', cityStateZip: 'A', showOnApplyPage: true });
    addProperty({ addressLine: 'Hidden', cityStateZip: 'B', showOnApplyPage: false });
    const pub = loadPublicProperties();
    expect(pub).toHaveLength(1);
    expect(pub[0].addressLine).toBe('Public');
  });

  it('returns empty array on malformed JSON', () => {
    localStorage.setItem('carwoods_portal_properties', '{invalid}');
    expect(loadProperties()).toEqual([]);
  });

  it('saveProperties and loadProperties round-trip', () => {
    const data = [{ id: 'x', addressLine: 'Test', cityStateZip: 'TX', showOnApplyPage: false }];
    saveProperties(data);
    expect(loadProperties()).toEqual(data);
  });
});
