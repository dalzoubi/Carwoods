import { describe, expect, it } from 'vitest';
import { Role } from './domain/constants.js';
import { isGuestRole } from './portalUtils';

describe('isGuestRole', () => {
  it('treats known portal roles as non-guest', () => {
    expect(isGuestRole(Role.TENANT)).toBe(false);
    expect(isGuestRole(Role.LANDLORD)).toBe(false);
    expect(isGuestRole(Role.ADMIN)).toBe(false);
    expect(isGuestRole(Role.AI_AGENT)).toBe(false);
  });

  it('treats unknown roles as guest', () => {
    expect(isGuestRole('')).toBe(true);
    expect(isGuestRole('SOMETHING_ELSE')).toBe(true);
  });
});
