import { describe, expect, it } from 'vitest';
import { collectClientDiagnostics } from './collectClientDiagnostics';

describe('collectClientDiagnostics', () => {
  it('returns the diagnostic keys the server expects', () => {
    const result = collectClientDiagnostics();
    expect(result).toEqual(expect.objectContaining({
      url: expect.any(String),
      pathname: expect.any(String),
      user_agent: expect.any(String),
      viewport: expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
      collected_at: expect.any(String),
    }));
  });

  it('never throws in a plain JSDOM environment', () => {
    expect(() => collectClientDiagnostics()).not.toThrow();
  });

  it('includes an ISO 8601 timestamp', () => {
    const result = collectClientDiagnostics();
    expect(() => new Date(result.collected_at).toISOString()).not.toThrow();
  });

  it('does not include anything that looks like an auth token', () => {
    const result = collectClientDiagnostics();
    const serialized = JSON.stringify(result);
    expect(serialized.toLowerCase()).not.toMatch(/bearer\s+/);
    expect(serialized.toLowerCase()).not.toMatch(/authorization/);
  });
});
