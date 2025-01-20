import { MODEL_OPTIONS } from 'quadratic-shared/AI_MODELS';
import type {
  AIModel,
  AnthropicModel,
  BedrockAnthropicModel,
  BedrockModel,
  OpenAIModel,
} from 'quadratic-shared/typesAndSchemasAI';

export function isBedrockModel(model: AIModel): model is BedrockModel {
  return MODEL_OPTIONS[model].provider === 'bedrock';
}

export function isAnthropicBedrockModel(model: AIModel): model is BedrockAnthropicModel {
  return MODEL_OPTIONS[model].provider === 'bedrock-anthropic';
}

export function isAnthropicModel(model: AIModel): model is AnthropicModel {
  return MODEL_OPTIONS[model].provider === 'anthropic';
}

export function isOpenAIModel(model: AIModel): model is OpenAIModel {
  return MODEL_OPTIONS[model].provider === 'openai';
}
