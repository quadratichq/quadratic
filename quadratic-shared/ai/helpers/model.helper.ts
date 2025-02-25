import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIModel,
  AIRequestBody,
  AnthropicModelKey,
  BedrockAnthropicModelKey,
  BedrockModelKey,
  ModelKey,
  OpenAIModelKey,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';

export function isBedrockModel(modelKey: ModelKey): modelKey is BedrockModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'bedrock';
}

export function isBedrockAnthropicModel(modelKey: ModelKey): modelKey is BedrockAnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'bedrock-anthropic';
}

export function isAnthropicModel(modelKey: ModelKey): modelKey is AnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'anthropic';
}

export function isXAIModel(modelKey: ModelKey): modelKey is XAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'xai';
}

export function isOpenAIModel(modelKey: ModelKey): modelKey is OpenAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'openai';
}

export const getModelFromModelKey = (modelKey: ModelKey): AIModel => {
  return MODELS_CONFIGURATION[modelKey].model;
};

export const getModelOptions = (
  modelKey: ModelKey,
  args: Pick<AIRequestBody, 'useTools' | 'useStream' | 'thinking'>
): {
  stream: boolean;
  temperature: number;
  max_tokens: number;
  thinking?: boolean;
  strickParams: boolean;
} => {
  const config = MODELS_CONFIGURATION[modelKey];
  const { canStream, canStreamWithToolCalls, max_tokens } = config;

  const { useTools, useStream } = args;
  const stream = canStream
    ? useTools
      ? canStreamWithToolCalls && (useStream ?? canStream)
      : useStream ?? canStream
    : false;

  const thinking = config.thinking && args.thinking;

  const temperature = thinking ? config.thinkingTemperature ?? config.temperature : config.temperature;

  const strickParams = !!config.strickParams;

  return { stream, temperature, max_tokens, thinking, strickParams };
};
