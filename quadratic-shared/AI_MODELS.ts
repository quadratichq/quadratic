import { AIModel, AIProviders } from 'quadratic-shared/typesAndSchemasAI';

export const DEFAULT_MODEL: AIModel = 'claude-3-5-sonnet-20241022';

// updating this will force the model to be reset to the default model in local storage
export const DEFAULT_MODEL_VERSION = 1;

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
  'gpt-4o-2024-08-06': {
    displayName: 'OpenAI: GPT-4o',
    temperature: 0,
    max_tokens: 4096, // not used for openai
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
  },
  o1: {
    displayName: 'OpenAI: o1',
    temperature: 1, // only temperature 1 is supported for o1
    max_tokens: 4096, // not used for openai
    canStream: false, // stream is not supported for o1
    canStreamWithToolCalls: false,
    enabled: true,
    provider: 'openai',
  },
  'claude-3-5-sonnet-20241022': {
    displayName: 'Anthropic: Claude 3.5 Sonnet',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'anthropic',
  },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    displayName: `Bedrock: Claude 3.5 Sonnet`,
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'bedrock-anthropic',
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    displayName: `Anthropic: Claude 3.5 Sonnet`,
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'bedrock-anthropic',
  },
  'ai21.jamba-1-5-large-v1:0': {
    displayName: 'AI21: Jamba 1.5 Large',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
  'cohere.command-r-plus-v1:0': {
    displayName: 'Cohere: Command R+',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: false,
    provider: 'bedrock',
  },
  'us.meta.llama3-2-90b-instruct-v1:0': {
    displayName: 'Meta: Llama 3.2 90B Instruct',
    temperature: 0,
    max_tokens: 2048,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
  'mistral.mistral-large-2407-v1:0': {
    displayName: 'Mistral: Mistral Large 2 (24.07)',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: false,
    provider: 'bedrock',
  },
} as const;
