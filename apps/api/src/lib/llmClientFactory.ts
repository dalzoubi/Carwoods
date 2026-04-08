/**
 * Module-level singleton factory for the LlmClient.
 *
 * Azure Functions v4 reuse the Node.js process across invocations within a warm
 * instance, so a single LlmClient instance per process is correct and desirable:
 * the circuit breaker accumulates state across requests within the same instance,
 * and the retry config is read from env once at startup.
 *
 * Returns null when GEMINI_API_KEY is absent (Elsa gracefully degrades to
 * admin-review mode without a live LLM).
 */

import { GeminiProvider, LlmClient, loadLlmConfigFromEnv } from './llm/index.js';
import type { LlmClient as LlmClientType } from './llm/index.js';

let _instance: LlmClientType | null | undefined = undefined;

export function getLlmClient(): LlmClientType | null {
  if (_instance !== undefined) return _instance;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    _instance = null;
    return null;
  }

  const config = loadLlmConfigFromEnv(process.env);
  const provider = new GeminiProvider(apiKey);
  _instance = new LlmClient({ provider, config });
  return _instance;
}

/**
 * Reset the singleton – only for tests that need a fresh instance.
 * Never call this in production code.
 */
export function _resetLlmClientSingleton(): void {
  _instance = undefined;
}
