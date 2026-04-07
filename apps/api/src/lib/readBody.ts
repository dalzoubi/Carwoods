import type { HttpRequest } from '@azure/functions';
import { unprocessable } from '../domain/errors.js';

export async function readJsonBody<T>(
  request: HttpRequest,
  maxBytes: number = 65_536
): Promise<T | null> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw unprocessable('request_too_large');
    }
  }

  const text = await request.text();
  if (!text) return null;

  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) {
    throw unprocessable('request_too_large');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
