import type { ModelConfig, ModelKey } from 'quadratic-shared/typesAndSchemasAI';

export const DEFAULT_MODEL: ModelKey = 'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0';

export const DEFAULT_GET_CHAT_NAME_MODEL: ModelKey = 'bedrock-anthropic:us.anthropic.claude-3-5-haiku-20241022-v1:0';

// updating this will force the model to be reset to the default model in local storage
export const DEFAULT_MODEL_VERSION = 4;

export const MODELS_CONFIGURATION: {
  [key in ModelKey]: ModelConfig;
} = {
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    displayName: `claude 3.7 sonnet`,
    temperature: 0,
    max_tokens: 16000,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'bedrock-anthropic',
  },
  'bedrock-anthropic:us.anthropic.claude-3-7-sonnet-20250219-v1:0:thinking': {
    model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    displayName: `claude 3.7 sonnet thinking`,
    temperature: 0,
    max_tokens: 16000,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'bedrock-anthropic',
    thinking: true,
    thinkingTemperature: 1,
  },
  'bedrock-anthropic:us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    model: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    displayName: `claude 3.5 sonnet`,
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'bedrock-anthropic',
  },
  'bedrock-anthropic:us.anthropic.claude-3-5-haiku-20241022-v1:0': {
    model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    displayName: 'claude 3.5 haiku',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'bedrock-anthropic',
  },
  'anthropic:claude-3-7-sonnet-20250219': {
    model: 'claude-3-7-sonnet-20250219',
    displayName: 'claude 3.7 sonnet',
    temperature: 0,
    max_tokens: 16000,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'anthropic',
  },
  'anthropic:claude-3-7-sonnet-20250219:thinking': {
    model: 'claude-3-7-sonnet-20250219',
    displayName: 'claude 3.7 sonnet thinking',
    temperature: 0,
    max_tokens: 16000,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'anthropic',
    thinking: true,
    thinkingTemperature: 1,
  },
  'anthropic:claude-3-5-sonnet-20241022': {
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'claude 3.5 sonnet',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'anthropic',
  },
  'anthropic:claude-3-5-haiku-20241022': {
    model: 'claude-3-5-haiku-20241022',
    displayName: 'claude 3.5 haiku',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'anthropic',
  },
  'openai:gpt-4.5-preview-2025-02-27': {
    model: 'gpt-4.5-preview-2025-02-27',
    displayName: 'gpt 4.5 preview',
    temperature: 0,
    max_tokens: 4096, // not used for openai
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
    strickParams: true,
  },
  'openai:gpt-4o-2024-11-20': {
    model: 'gpt-4o-2024-11-20',
    displayName: 'gpt 4o',
    temperature: 0,
    max_tokens: 4096, // not used for openai
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
    strickParams: true,
  },
  'openai:o1-2024-12-17': {
    model: 'o1-2024-12-17',
    displayName: 'o1',
    temperature: 1, // only temperature 1 is supported for o1
    max_tokens: 4096, // not used for openai
    canStream: false, // stream is not supported for o1
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'openai',
    strickParams: true,
  },
  'openai:o3-mini-2025-01-31': {
    model: 'o3-mini-2025-01-31',
    displayName: 'o3 mini',
    temperature: 1, // only temperature 1 is supported for o1
    max_tokens: 4096, // not used for openai
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
    strickParams: true,
  },
  'xai:grok-2-1212': {
    model: 'grok-2-1212',
    displayName: `grok 2`,
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'xai',
    strickParams: false,
  },
  'xai:grok-beta': {
    model: 'grok-beta',
    displayName: `grok beta`,
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'xai',
    strickParams: false,
  },
  'bedrock:us.meta.llama3-2-90b-instruct-v1:0': {
    model: 'us.meta.llama3-2-90b-instruct-v1:0',
    displayName: 'llama 3.2 90b instruct',
    temperature: 0,
    max_tokens: 2048,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
  'bedrock:mistral.mistral-large-2407-v1:0': {
    model: 'mistral.mistral-large-2407-v1:0',
    displayName: 'mistral large 2 (24.07)',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
} as const;
