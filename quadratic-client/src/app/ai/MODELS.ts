import { debug } from '@/app/debugFlags';
import { AIModel, AIProviders } from 'quadratic-shared/typesAndSchemasAI';

export const MODEL_OPTIONS: {
  [key in AIModel]: {
    displayName: string;
    temperature: number;
    max_tokens: number | undefined;
    canStream: boolean;
    canStreamWithToolCalls: boolean;
    enabled: boolean;
    provider: AIProviders;
  };
} = {
  'gpt-4o-2024-08-06': {
    displayName: 'OpenAI: gpt-4o',
    temperature: 0,
    max_tokens: undefined,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'openai',
  },
  'o1-preview': {
    displayName: 'OpenAI: o1-preview',
    temperature: 1, // only temperature 1 is supported for o1-preview
    max_tokens: undefined,
    canStream: false, // stream is not supported for o1-preview
    canStreamWithToolCalls: true,
    enabled: debug,
    provider: 'openai',
  },
  'claude-3-5-sonnet-20241022': {
    displayName: 'Anthropic: claude-3.5-sonnet',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: true,
    provider: 'anthropic',
  },
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    displayName: 'Anthropic: claude-3-sonnet',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: debug,
    provider: 'bedrock',
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    displayName: 'Anthropic: claude-3-haiku',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: debug,
    provider: 'bedrock',
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    displayName: 'Anthropic: claude-3.5-sonnet v1',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: debug,
    provider: 'bedrock',
  },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    displayName: 'Anthropic: claude-3.5-sonnet v2',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: true,
    enabled: debug,
    provider: 'bedrock',
  },
  'meta.llama3-1-405b-instruct-v1:0': {
    displayName: 'Meta: llama-3.1-405b-instruct',
    temperature: 0,
    max_tokens: 2048,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: debug,
    provider: 'bedrock',
  },
  'mistral.mistral-large-2402-v1:0': {
    displayName: 'Mistral: mistral-large-2402',
    temperature: 0,
    max_tokens: 8192,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: debug,
    provider: 'bedrock',
  },
  'ai21.jamba-1-5-large-v1:0': {
    displayName: 'AI21: jamba-1.5-large',
    temperature: 0,
    max_tokens: 4096,
    canStream: true,
    canStreamWithToolCalls: false,
    enabled: debug,
    provider: 'bedrock',
  },
} as const;
