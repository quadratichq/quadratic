import type { AIModel, AIProviders } from 'quadratic-shared/typesAndSchemasAI';

export const DEFAULT_MODEL: AIModel = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
export const DEFAULT_GET_CHAT_NAME_MODEL: AIModel = 'anthropic.claude-3-5-haiku-20241022-v1:0';

// updating this will force the model to be reset to the default model in local storage
export const DEFAULT_MODEL_VERSION = 2;

export const MODEL_OPTIONS: {
  [key in AIModel]: {
    displayName: string;
    temperature: number;
    max_tokens: number;
    canStream: boolean;
    canStreamWithToolCalls: boolean;
    enabled: boolean;
    provider: AIProviders;
  };
} = {
  'gpt-4o-2024-11-20': {
    displayName: 'OpenAI: GPT-4o',
    temperature: 0,
    max_tokens: 4096, // not used for openai
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
  },
  'o1-2024-12-17': {
    displayName: 'OpenAI: o1',
    temperature: 1, // only temperature 1 is supported for o1
    max_tokens: 4096, // not used for openai
    canStream: false, // stream is not supported for o1
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'openai',
  },
  'o3-mini-2025-01-31': {
    displayName: 'OpenAI: o3-mini',
    temperature: 1, // only temperature 1 is supported for o1
    max_tokens: 4096, // not used for openai
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
  },
  'claude-3-5-sonnet-20241022': {
    displayName: 'Anthropic: Claude 3.5 Sonnet',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'anthropic',
  },
  'claude-3-5-haiku-20241022': {
    displayName: 'Anthropic: Claude 3.5 Haiku',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'anthropic',
  },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    displayName: `Bedrock: Claude 3.5 Sonnet`,
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'bedrock-anthropic',
  },
  'anthropic.claude-3-5-haiku-20241022-v1:0': {
    displayName: 'Bedrock: Claude 3.5 Haiku',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'bedrock-anthropic',
  },
  'us.meta.llama3-2-90b-instruct-v1:0': {
    displayName: 'Bedrock: Llama 3.2 90B Instruct',
    temperature: 0,
    max_tokens: 2048,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
  'mistral.mistral-large-2407-v1:0': {
    displayName: 'Bedrock: Mistral Large 2 (24.07)',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
} as const;
