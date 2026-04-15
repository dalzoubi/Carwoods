import { describe, it, expect } from 'vitest';
import {
  escapeVCardText,
  resolveVCardDisplayName,
  buildVCard3,
  slugifyVCardFilenameBase,
  VCARD_ORG_NAME,
} from './exportContactCard';

describe('exportContactCard', () => {
  it('escapes vCard special characters', () => {
    expect(escapeVCardText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
  });

  it('resolveVCardDisplayName prefers full name then email', () => {
    expect(resolveVCardDisplayName({ firstName: 'A', lastName: 'B', fallbackEmail: 'x@y.com' })).toBe('A B');
    expect(resolveVCardDisplayName({ firstName: '', lastName: '', fallbackEmail: 'x@y.com' })).toBe('x@y.com');
  });

  it('buildVCard3 includes expected properties', () => {
    const doc = buildVCard3({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'a@example.com',
      phone: '713-555-0100',
      org: VCARD_ORG_NAME,
      title: 'Tenant portal',
      adr: { street: '1 Main', locality: 'Houston', region: 'TX', postalCode: '77001' },
    });
    expect(doc).toContain('BEGIN:VCARD');
    expect(doc).toContain('VERSION:3.0');
    expect(doc).toContain('FN:Alice Smith');
    expect(doc).toContain('N:Smith;Alice;;;');
    expect(doc).toContain('ORG:Carwoods');
    expect(doc).toContain('TITLE:Tenant portal');
    expect(doc).toContain('EMAIL;TYPE=INTERNET:a@example.com');
    expect(doc).toContain('TEL;TYPE=VOICE:713-555-0100');
    expect(doc).toContain('ADR;TYPE=HOME:;;1 Main;Houston;TX;77001;');
    expect(doc).toContain('END:VCARD');
  });

  it('slugifyVCardFilenameBase handles unicode and falls back', () => {
    expect(slugifyVCardFilenameBase('مرحبا', 'test@x.com')).toBe('test-at-x-com');
    expect(slugifyVCardFilenameBase('', '', '')).toBe('contact');
  });
});
