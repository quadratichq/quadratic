import type { AIRates } from 'quadratic-shared/typesAndSchemasAI';

// Claude Sonnet 4.5 pricing sources:
// https://docs.anthropic.com/en/docs/about-claude/pricing
// https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
export const claude_sonnet_4_5_20250926_rate: AIRates = {
  rate_per_million_input_tokens: 3,
  rate_per_million_output_tokens: 15,
  rate_per_million_cache_read_tokens: 0.3,
  rate_per_million_cache_write_tokens: 3.75,
};

// Gemini 2.5 Pro pricing sources:
// https://cloud.google.com/vertex-ai/generative-ai/pricing
// https://ai.google.dev/gemini-api/docs/pricing
// https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro
export const gemini_2_5_pro_rate: AIRates = {
  rate_per_million_input_tokens: 1.25,
  rate_per_million_output_tokens: 10,
  rate_per_million_cache_read_tokens: 0.125,
  rate_per_million_cache_write_tokens: 4.5,
};

export const gemini_3_flash_rate: AIRates = {
  rate_per_million_input_tokens: 0.5,
  rate_per_million_output_tokens: 3,
  rate_per_million_cache_read_tokens: 0.05,
  rate_per_million_cache_write_tokens: 1,
};

export const gemini_3_pro_rate: AIRates = {
  rate_per_million_input_tokens: 2,
  rate_per_million_output_tokens: 12,
  rate_per_million_cache_read_tokens: 0.2,
  rate_per_million_cache_write_tokens: 4.5,
};

// Gemini 2.5 Flash pricing sources:
// https://cloud.google.com/vertex-ai/generative-ai/pricing
// https://ai.google.dev/gemini-api/docs/pricing
export const gemini_2_5_flash_rate: AIRates = {
  rate_per_million_input_tokens: 0.3,
  rate_per_million_output_tokens: 2.5,
  rate_per_million_cache_read_tokens: 0.03,
  rate_per_million_cache_write_tokens: 1,
};

// Gemini 2.5 Flash Lite pricing sources:
// https://cloud.google.com/vertex-ai/generative-ai/pricing
// https://ai.google.dev/gemini-api/docs/pricing
// https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite
export const gemini_2_5_flash_lite_rate: AIRates = {
  rate_per_million_input_tokens: 0.1,
  rate_per_million_output_tokens: 0.4,
  rate_per_million_cache_read_tokens: 0.01,
  rate_per_million_cache_write_tokens: 1,
};

// Claude Haiku 4.5 pricing sources:
// https://platform.claude.com/docs/en/about-claude/pricing
// https://docs.anthropic.com/en/docs/about-claude/pricing
// https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
export const claude_haiku_4_5_20251001_rate: AIRates = {
  rate_per_million_input_tokens: 1,
  rate_per_million_output_tokens: 5,
  rate_per_million_cache_read_tokens: 0.1,
  rate_per_million_cache_write_tokens: 1.25,
};

// Claude Opus 4.5 pricing sources:
// https://docs.anthropic.com/en/docs/about-claude/pricing
// https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
export const claude_opus_4_5_20251101_rate: AIRates = {
  rate_per_million_input_tokens: 5,
  rate_per_million_output_tokens: 25,
  rate_per_million_cache_read_tokens: 0.5,
  rate_per_million_cache_write_tokens: 6.25,
};
export const claude_opus_4_6_20260205_rate: AIRates = {
  rate_per_million_input_tokens: 5,
  rate_per_million_output_tokens: 25,
  rate_per_million_cache_read_tokens: 0.5,
  rate_per_million_cache_write_tokens: 6.25,
};
