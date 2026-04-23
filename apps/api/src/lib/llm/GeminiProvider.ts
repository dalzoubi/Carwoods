/**
 * Gemini-specific LlmProvider implementation.
 *
 * Responsibilities:
 * - Build the correct generateContent endpoint URL.
 * - Translate HTTP status codes into typed LlmError subclasses.
 * - Extract and return the text from the candidate response.
 * - Parse the Retry-After header when present (429 responses).
 *
 * This class knows about Gemini's REST API shape. Nothing outside this file
 * should import Gemini-specific types or URL patterns.
 */

import type { LlmProvider, LlmProviderResult, LlmRequest } from './llmTypes.js';
import {
  LlmClientError,
  LlmParseError,
  LlmRateLimitError,
  LlmServerError,
  LlmTimeoutError,
} from './llmErrors.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiCandidateContent = {
  parts?: Array<{ text?: string }>;
};

type GeminiCandidate = {
  content?: GeminiCandidateContent;
};

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
};

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(private readonly apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GeminiProvider: apiKey must not be empty');
    }
  }

  async complete(request: LlmRequest, model: string, signal: AbortSignal): Promise<LlmProviderResult> {
    const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
      ],
      generationConfig: {
        // Do NOT use responseMimeType — not supported on all model versions and
        // causes silent 400s (notably on gemini-1.5-flash and some gemini-2.0 builds).
        // We rely on extractJsonFromText in the service layer to parse raw output.
        temperature: request.temperature ?? 0.2,
      },
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body,
      });
    } catch (err: unknown) {
      // AbortError → timeout (the caller sets the signal)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LlmTimeoutError(this.name, model, 0 /* caller knows the timeout */);
      }
      // Network-level failure – treat like a 503 (retryable)
      throw new LlmServerError(503, this.name, model, err);
    }

    if (!res.ok) {
      await this.throwForStatus(res, model);
    }

    let payload: GeminiGenerateContentResponse;
    try {
      payload = (await res.json()) as GeminiGenerateContentResponse;
    } catch (err) {
      throw new LlmParseError('Gemini response body was not valid JSON', err);
    }

    const text = payload.candidates
      ?.flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('\n')
      .trim();

    if (!text) {
      throw new LlmParseError('Gemini returned empty candidate text');
    }

    const tokensUsed = payload.usageMetadata?.totalTokenCount;
    return { text, tokensUsed };
  }

  private async throwForStatus(res: Response, model: string): Promise<never> {
    const { status } = res;

    if (status === 429) {
      const retryAfterMs = this.parseRetryAfter(res.headers.get('Retry-After'));
      throw new LlmRateLimitError(retryAfterMs, this.name, model);
    }

    if (status >= 500) {
      throw new LlmServerError(status, this.name, model);
    }

    // 4xx other than 429 are NOT retryable (bad payload, deprecated model, auth failure, etc.)
    throw new LlmClientError(status, this.name, model);
  }

  private parseRetryAfter(headerValue: string | null): number | null {
    if (!headerValue) return null;
    const seconds = parseFloat(headerValue);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
    // Could be an HTTP-date but we ignore that complexity here
    return null;
  }
}
