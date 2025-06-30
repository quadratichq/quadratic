import type { AIRates } from 'quadratic-shared/typesAndSchemasAI';

export const claude_sonnet_3_5_20250514_rate: AIRates = {
  rate_per_million_input_tokens: 15,
  rate_per_million_output_tokens: 75,
  rate_per_million_cache_read_tokens: 1.5,
  rate_per_million_cache_write_tokens: 18.75,
};
export const claude_sonnet_3_7_20250514_rate: AIRates = claude_sonnet_3_5_20250514_rate;
export const claude_sonnet_4_20250514_rate: AIRates = claude_sonnet_3_5_20250514_rate;

export const gemini_2_5_pro_rate: AIRates = {
  rate_per_million_input_tokens: 1.25,
  rate_per_million_output_tokens: 10,
  rate_per_million_cache_read_tokens: 0,
  rate_per_million_cache_write_tokens: 0,
};
export const gemini_2_5_flash_rate: AIRates = {
  rate_per_million_input_tokens: 0.3,
  rate_per_million_output_tokens: 2.5,
  rate_per_million_cache_read_tokens: 0,
  rate_per_million_cache_write_tokens: 0,
};
export const gemini_2_5_flash_lite_rate: AIRates = {
  rate_per_million_input_tokens: 0.1,
  rate_per_million_output_tokens: 0.4,
  rate_per_million_cache_read_tokens: 0,
  rate_per_million_cache_write_tokens: 0,
};
export const gemini_2_0_flash_rate: AIRates = {
  rate_per_million_input_tokens: 0.1,
  rate_per_million_output_tokens: 0.4,
  rate_per_million_cache_read_tokens: 0,
  rate_per_million_cache_write_tokens: 0,
};
