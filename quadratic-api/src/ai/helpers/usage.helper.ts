import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIUsage } from 'quadratic-shared/typesAndSchemasAI';
import { AI_MARGIN } from '../../env-vars';

export function calculateUsage(usage: AIUsage): number {
  const modelKey = usage.modelKey;
  if (!modelKey) {
    return 0;
  }

  const rate_per_million_input_tokens = MODELS_CONFIGURATION[modelKey].rate_per_million_input_tokens;
  const rate_per_million_output_tokens = MODELS_CONFIGURATION[modelKey].rate_per_million_output_tokens;
  const rate_per_million_cache_read_tokens = MODELS_CONFIGURATION[modelKey].rate_per_million_cache_read_tokens;
  const rate_per_million_cache_write_tokens = MODELS_CONFIGURATION[modelKey].rate_per_million_cache_write_tokens;
  const cost =
    ((usage.inputTokens * rate_per_million_input_tokens +
      usage.outputTokens * rate_per_million_output_tokens +
      usage.cacheReadTokens * rate_per_million_cache_read_tokens +
      usage.cacheWriteTokens * rate_per_million_cache_write_tokens) /
      1_000_000) *
    (1 + AI_MARGIN);

  return cost;
}
