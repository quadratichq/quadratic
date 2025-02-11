import { MODEL_OPTIONS } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModel, AIUsage } from 'quadratic-shared/typesAndSchemasAI';

export function calculateUsage({
  model,
  input_tokens,
  output_tokens,
  cache_read_tokens,
  cache_write_tokens,
}: {
  model: AIModel;
} & Pick<AIUsage, 'input_tokens' | 'output_tokens' | 'cache_read_tokens' | 'cache_write_tokens'>): AIUsage {
  const rate_per_million_input_tokens = MODEL_OPTIONS[model].rate_per_million_input_tokens;
  const rate_per_million_output_tokens = MODEL_OPTIONS[model].rate_per_million_output_tokens;
  const rate_per_million_cache_read_tokens = MODEL_OPTIONS[model].rate_per_million_cache_read_tokens;
  const rate_per_million_cache_write_tokens = MODEL_OPTIONS[model].rate_per_million_cache_write_tokens;
  const net_cost =
    (input_tokens * rate_per_million_input_tokens +
      output_tokens * rate_per_million_output_tokens +
      cache_read_tokens * rate_per_million_cache_read_tokens +
      cache_write_tokens * rate_per_million_cache_write_tokens) /
    1000000;

  const usage: AIUsage = {
    model,
    rate_per_million_input_tokens,
    rate_per_million_output_tokens,
    rate_per_million_cache_read_tokens,
    rate_per_million_cache_write_tokens,
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_write_tokens,
    net_cost,
  };

  return usage;
}
