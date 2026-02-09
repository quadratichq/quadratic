import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';

/**
 * Context limits (input tokens) from provider documentation.
 * Anthropic: support.anthropic.com (200K standard; 1M for Opus/Sonnet 4+ with beta), docs.anthropic.com/context-windows
 * OpenAI: platform.openai.com/docs/models (GPT-4.1 1M, GPT-5 400K), help.openai.com (o3/o4 128K)
 * Google: cloud.google.com/vertex-ai/generative-ai/docs (Gemini 2.5 1M)
 * DeepSeek: api-docs.deepseek.com/quick_start/pricing (128K)
 * xAI: docs.x.ai/developers/models
 */

export const DEFAULT_CONTEXT_LIMIT = 200_000;
export const CONTEXT_LIMIT_128K = 128_000;
export const CONTEXT_LIMIT_256K = 256_000;
export const CONTEXT_LIMIT_400K = 400_000;
export const CONTEXT_LIMIT_1M = 1_048_576;

const CONTEXT_LIMIT_BY_PROVIDER: Record<string, number> = {
  'vertexai-anthropic': DEFAULT_CONTEXT_LIMIT,
  'bedrock-anthropic': DEFAULT_CONTEXT_LIMIT,
  anthropic: DEFAULT_CONTEXT_LIMIT,
  vertexai: CONTEXT_LIMIT_1M,
  geminiai: CONTEXT_LIMIT_1M,
  xai: CONTEXT_LIMIT_256K,
  openai: CONTEXT_LIMIT_400K,
  'azure-openai': CONTEXT_LIMIT_400K,
  baseten: CONTEXT_LIMIT_128K,
  fireworks: CONTEXT_LIMIT_128K,
  'open-router': CONTEXT_LIMIT_128K,
  bedrock: CONTEXT_LIMIT_128K,
  quadratic: DEFAULT_CONTEXT_LIMIT,
};

/**
 * Returns the context limit (input tokens) for a model key.
 * Uses MODELS_CONFIGURATION.contextLimit when set, otherwise model-specific overrides and provider defaults.
 */
export function getContextLimit(modelKey: AIModelKey | undefined): number {
  if (!modelKey) return DEFAULT_CONTEXT_LIMIT;

  const config = MODELS_CONFIGURATION[modelKey as AIModelKey];
  if (config?.contextLimit != null) return config.contextLimit;

  if (modelKey.includes('claude-sonnet') || modelKey.includes('claude-opus')) return CONTEXT_LIMIT_1M;
  if (modelKey.includes('gpt-4.1')) return CONTEXT_LIMIT_1M;
  if (modelKey.includes('gpt-5')) return CONTEXT_LIMIT_400K;
  if (modelKey.includes('o3') || modelKey.includes('o4')) return CONTEXT_LIMIT_128K;
  if (modelKey.includes('qwen') || modelKey.includes('Qwen')) return CONTEXT_LIMIT_256K;
  if (modelKey.includes('kimi') || modelKey.includes('Kimi')) return CONTEXT_LIMIT_128K;
  if (modelKey.includes('deepseek') || modelKey.includes('DeepSeek')) return CONTEXT_LIMIT_128K;

  const provider = modelKey.split(':')[0];
  return CONTEXT_LIMIT_BY_PROVIDER[provider] ?? DEFAULT_CONTEXT_LIMIT;
}
