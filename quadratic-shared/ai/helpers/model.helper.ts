import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIModel,
  AIModelKey,
  AIRequestBody,
  AnthropicModelKey,
  BedrockAnthropicModelKey,
  BedrockModelKey,
  GenAIModelKey,
  OpenAIModelKey,
  VertexAIAnthropicModelKey,
  VertexAIModelKey,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { aiToolsSpec } from '../specs/aiToolsSpec';

export function isVertexAIAnthropicModel(modelKey: AIModelKey): modelKey is VertexAIAnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'vertexai-anthropic';
}

export function isBedrockAnthropicModel(modelKey: AIModelKey): modelKey is BedrockAnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'bedrock-anthropic';
}

export function isAnthropicModel(modelKey: AIModelKey): modelKey is AnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'anthropic';
}

export function isXAIModel(modelKey: AIModelKey): modelKey is XAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'xai';
}

export function isOpenAIModel(modelKey: AIModelKey): modelKey is OpenAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'openai';
}

export function isVertexAIModel(modelKey: AIModelKey): modelKey is VertexAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'vertexai';
}

export function isGenAIModel(modelKey: AIModelKey): modelKey is GenAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'genai';
}

export function isBedrockModel(modelKey: AIModelKey): modelKey is BedrockModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'bedrock';
}

export const getModelFromModelKey = (modelKey: AIModelKey): AIModel => {
  return MODELS_CONFIGURATION[modelKey].model;
};

export const getModelOptions = (
  modelKey: AIModelKey,
  args: Pick<AIRequestBody, 'source' | 'useStream'>
): {
  stream: boolean;
  temperature: number;
  max_tokens: number;
  thinking?: boolean;
  promptCaching: boolean;
  strictParams: boolean;
} => {
  const config = MODELS_CONFIGURATION[modelKey];
  const { canStream, canStreamWithToolCalls, max_tokens } = config;

  const { useStream } = args;
  const useTools = Object.values(aiToolsSpec).some((tool) => tool.sources.includes(args.source));
  const stream = canStream
    ? useTools
      ? canStreamWithToolCalls && (useStream ?? canStream)
      : (useStream ?? canStream)
    : false;

  const thinking = config.thinking;

  const temperature = thinking ? (config.thinkingTemperature ?? config.temperature) : config.temperature;

  const promptCaching = config.promptCaching;

  const strictParams = !!config.strictParams;

  return { stream, temperature, max_tokens, thinking, promptCaching, strictParams };
};
