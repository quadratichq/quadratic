import { DEFAULT_MODEL, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIModel,
  AIRequestBody,
  AnthropicModel,
  BedrockAnthropicModel,
  BedrockModel,
  OpenAIModel,
  XAIModel,
} from 'quadratic-shared/typesAndSchemasAI';

export function isBedrockModel(model: AIModel): model is BedrockModel {
  return Object.values(MODELS_CONFIGURATION).find((config) => config.model === model)?.provider === 'bedrock';
}

export function isBedrockAnthropicModel(model: AIModel): model is BedrockAnthropicModel {
  return Object.values(MODELS_CONFIGURATION).find((config) => config.model === model)?.provider === 'bedrock-anthropic';
}

export function isAnthropicModel(model: AIModel): model is AnthropicModel {
  return Object.values(MODELS_CONFIGURATION).find((config) => config.model === model)?.provider === 'anthropic';
}

export function isXAIModel(model: AIModel): model is XAIModel {
  return Object.values(MODELS_CONFIGURATION).find((config) => config.model === model)?.provider === 'xai';
}

export function isOpenAIModel(model: AIModel): model is OpenAIModel {
  return Object.values(MODELS_CONFIGURATION).find((config) => config.model === model)?.provider === 'openai';
}

export const getModelOptions = (
  model: AIModel,
  args: Pick<AIRequestBody, 'useTools' | 'useStream' | 'thinking'>
): {
  stream: boolean;
  temperature: number;
  max_tokens: number;
  thinking?: boolean;
  strickParams: boolean;
} => {
  const config =
    Object.values(MODELS_CONFIGURATION).find((config) => config.model === model) ?? MODELS_CONFIGURATION[DEFAULT_MODEL];
  if (!config) {
    throw new Error(`Model ${model} not found`);
  }

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
