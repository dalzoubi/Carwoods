/**
 * Typed domain errors for use-case layer.
 *
 * Handlers map these to HTTP status codes; business logic throws them without
 * knowing anything about HTTP.
 */

export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNPROCESSABLE';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function notFound(detail?: string): DomainError {
  return new DomainError('NOT_FOUND', 'not_found', detail);
}

export function forbidden(detail?: string): DomainError {
  return new DomainError('FORBIDDEN', 'forbidden', detail);
}

export function validationError(message: string, detail?: string): DomainError {
  return new DomainError('VALIDATION', message, detail);
}

export function conflictError(message: string, detail?: string): DomainError {
  return new DomainError('CONFLICT', message, detail);
}

export function unprocessable(message: string, detail?: string): DomainError {
  return new DomainError('UNPROCESSABLE', message, detail);
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
