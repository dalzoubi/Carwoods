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

type LlmModelOverrides = {
  primaryModel?: string;
  fallbackModel?: string | null;
};

const _instances = new Map<string, LlmClientType | null>();

function buildCacheKey(
  apiKey: string,
  primaryModel: string,
  fallbackModel: string | null
): string {
  return `${apiKey}::${primaryModel}::${fallbackModel ?? 'none'}`;
}

export function getLlmClient(overrides?: LlmModelOverrides): LlmClientType | null {
  const primaryOverride = overrides?.primaryModel?.trim();
  const fallbackOverride = overrides?.fallbackModel === undefined
    ? undefined
    : overrides.fallbackModel === null
      ? null
      : overrides.fallbackModel.trim() || null;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const baseConfig = loadLlmConfigFromEnv(process.env);
  const config = {
    ...baseConfig,
    primaryModel: primaryOverride || baseConfig.primaryModel,
    fallbackModel: fallbackOverride === undefined ? baseConfig.fallbackModel : fallbackOverride,
  };
  const cacheKey = buildCacheKey(apiKey, config.primaryModel, config.fallbackModel);
  const cached = _instances.get(cacheKey);
  if (cached !== undefined) return cached;

  const provider = new GeminiProvider(apiKey);
  const instance = new LlmClient({ provider, config });
  _instances.set(cacheKey, instance);
  return instance;
}

/**
 * Reset the singleton – only for tests that need a fresh instance.
 * Never call this in production code.
 */
export function _resetLlmClientSingleton(): void {
  _instances.clear();
}
