import { describe, expect, it } from 'vitest';
import { sanitizeError } from './sanitizeError';

describe('sanitizeError', () => {
  it('returns generic message for null', () => {
    expect(sanitizeError(null)).toEqual({ message: 'Unknown error' });
  });

  it('returns generic message for undefined', () => {
    expect(sanitizeError(undefined)).toEqual({ message: 'Unknown error' });
  });

  it('wraps a string error', () => {
    expect(sanitizeError('boom')).toEqual({ message: 'boom' });
  });

  it('extracts name, message, code, status from an Error with attached fields', () => {
    const err = new Error('nope');
    err.code = 'E_NOPE';
    err.status = 500;
    expect(sanitizeError(err)).toEqual({
      name: 'Error',
      message: 'nope',
      code: 'E_NOPE',
      status: 500,
    });
  });

  it('falls back to statusCode when status absent on Error', () => {
    const err = new Error('nope');
    err.statusCode = 404;
    expect(sanitizeError(err)).toEqual({
      name: 'Error',
      message: 'nope',
      code: undefined,
      status: 404,
    });
  });

  it('extracts status, code, message from a plain object', () => {
    const err = { status: 503, code: 'database_unconfigured', message: 'db missing' };
    expect(sanitizeError(err)).toEqual({
      code: 'database_unconfigured',
      status: 503,
      message: 'db missing',
    });
  });

  it('uses statusText when message missing on plain object', () => {
    expect(sanitizeError({ status: 404, statusText: 'Not Found' })).toEqual({
      code: undefined,
      status: 404,
      message: 'Not Found',
    });
  });

  it('stringifies unknown primitives', () => {
    expect(sanitizeError(42)).toEqual({ message: '42' });
    expect(sanitizeError(true)).toEqual({ message: 'true' });
  });
});
