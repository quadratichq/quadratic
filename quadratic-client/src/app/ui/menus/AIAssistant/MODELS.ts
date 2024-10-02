import { debug } from '@/app/debugFlags';
import { AnthropicModel, OpenAIModel } from 'quadratic-shared/typesAndSchemasAI';

export const MODEL_OPTIONS: {
  [key in AnthropicModel | OpenAIModel]: {
    displayName: string;
    temperature: number;
    stream: boolean;
    enabled: boolean;
  };
} = {
  'gpt-4o': {
    displayName: 'OpenAI: gpt-4o',
    temperature: 0,
    stream: true,
    enabled: true,
  },
  'claude-3-5-sonnet-20240620': {
    displayName: 'Anthropic: claude-3.5-sonnet',
    temperature: 0,
    stream: true,
    enabled: true,
  },
  'gpt-4o-2024-08-06': {
    displayName: 'OpenAI: gpt-4o-2024-08-06',
    temperature: 0,
    stream: true,
    enabled: debug,
  },
  'o1-preview': {
    displayName: 'OpenAI: o1-preview',
    temperature: 1, // only temperature 1 is supported for o1-preview
    stream: false, // stream is not supported for o1-preview
    enabled: debug,
  },
} as const;
