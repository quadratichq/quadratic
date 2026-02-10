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
 * Anchored model-id patterns for context limit. Applied to config.model (the API model identifier).
 * Checked in order; first match wins. More specific patterns must appear before broader ones.
 * Patterns match model-id segments to avoid false positives (e.g. gpt-4.10 matching gpt-4.1, o30 matching o3).
 * Composite ids like "us.anthropic.claude-sonnet-4-5-..." are matched by segment.
 */
const CONTEXT_LIMIT_BY_MODEL: ReadonlyArray<{ pattern: RegExp; limit: number }> = [
  { pattern: /gpt-4\.1(?:-|$)/i, limit: CONTEXT_LIMIT_1M },
  { pattern: /gpt-5(?:-|\.|$)/i, limit: CONTEXT_LIMIT_400K },
  { pattern: /(?:^|[-./])o3(?:-|$|\/|\.)/i, limit: CONTEXT_LIMIT_128K },
  { pattern: /(?:^|[-./])o4(?:-|$|\/|\.)/i, limit: CONTEXT_LIMIT_128K },
  { pattern: /(?:^|[-./])qwen(?:-|$|\/|\.)/i, limit: CONTEXT_LIMIT_256K },
  { pattern: /(?:^|[-./])kimi(?:-|$|\/|\.)/i, limit: CONTEXT_LIMIT_128K },
  { pattern: /(?:^|[-./])deepseek(?:-|$|\/|\.)/i, limit: CONTEXT_LIMIT_128K },
];

function getContextLimitByModelId(modelId: string): number | undefined {
  for (const { pattern, limit } of CONTEXT_LIMIT_BY_MODEL) {
    if (pattern.test(modelId)) return limit;
  }
  return undefined;
}

/**
 * Returns the context limit (input tokens) for a model key.
 * Uses MODELS_CONFIGURATION.contextLimit when set, then model-id overrides (from config.model),
 * then provider default. Model keys are "provider:modelId" or "provider:modelId:suffix".
 */
export function getContextLimit(modelKey: AIModelKey | undefined): number {
  if (!modelKey) return DEFAULT_CONTEXT_LIMIT;

  const config = MODELS_CONFIGURATION[modelKey as AIModelKey];
  if (!config) {
    const provider = modelKey.split(':')[0];
    return CONTEXT_LIMIT_BY_PROVIDER[provider] ?? DEFAULT_CONTEXT_LIMIT;
  }
  if (config.contextLimit != null) return config.contextLimit;

  const modelLimit = getContextLimitByModelId(config.model);
  if (modelLimit != null) return modelLimit;

  return CONTEXT_LIMIT_BY_PROVIDER[config.provider] ?? DEFAULT_CONTEXT_LIMIT;
}
