import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIModel,
  AIModelKey,
  AIRequestBody,
  AnthropicModelKey,
  AzureOpenAIModelKey,
  BasetenModelKey,
  BedrockAnthropicModelKey,
  BedrockModelKey,
  GeminiAIModelKey,
  ModelMode,
  OpenAIModelKey,
  OpenRouterModelKey,
  QuadraticModelKey,
  VertexAIAnthropicModelKey,
  VertexAIModelKey,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { aiToolsSpec } from '../specs/aiToolsSpec';

export function isQuadraticModel(modelKey: AIModelKey): modelKey is QuadraticModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'quadratic';
}

export function isVertexAIAnthropicModel(modelKey: AIModelKey): modelKey is VertexAIAnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'vertexai-anthropic';
}

export function isBedrockAnthropicModel(modelKey: AIModelKey): modelKey is BedrockAnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'bedrock-anthropic';
}

export function isAnthropicModel(modelKey: AIModelKey): modelKey is AnthropicModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'anthropic';
}

export function isOpenAIModel(modelKey: AIModelKey): modelKey is OpenAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'openai';
}

export function isXAIModel(modelKey: AIModelKey): modelKey is XAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'xai';
}

export function isAzureOpenAIModel(modelKey: AIModelKey): modelKey is AzureOpenAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'azure-openai';
}

export function isBasetenModel(modelKey: AIModelKey): modelKey is BasetenModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'baseten';
}

export function isOpenRouterModel(modelKey: AIModelKey): modelKey is OpenRouterModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'open-router';
}

export function isVertexAIModel(modelKey: AIModelKey): modelKey is VertexAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'vertexai';
}

export function isGenAIModel(modelKey: AIModelKey): modelKey is GeminiAIModelKey {
  return MODELS_CONFIGURATION[modelKey].provider === 'geminiai';
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
  thinkingBudget?: number;
  promptCaching: boolean;
  strictParams: boolean;
  imageSupport: boolean;
  aiModelMode: ModelMode;
} => {
  const config = MODELS_CONFIGURATION[modelKey];
  const { canStream, canStreamWithToolCalls } = config;

  const { useStream } = args;
  const useTools = Object.values(aiToolsSpec).some((tool) => tool.sources.includes(args.source));
  const stream = canStream
    ? useTools
      ? canStreamWithToolCalls && (useStream ?? canStream)
      : (useStream ?? canStream)
    : false;

  return {
    stream,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    thinking: config.thinking,
    thinkingBudget: config.thinkingBudget,
    promptCaching: config.promptCaching,
    strictParams: !!config.strictParams,
    imageSupport: config.imageSupport,
    aiModelMode: config.mode,
  };
};
