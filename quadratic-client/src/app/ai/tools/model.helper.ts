import { MODEL_OPTIONS } from '@/app/ai/MODELS';
import { AIModel, AnthropicModel, BedrockModel, OpenAIModel } from 'quadratic-shared/typesAndSchemasAI';

export function isBedrockModel(model: AIModel): model is BedrockModel {
  return MODEL_OPTIONS[model].provider === 'bedrock';
}

export function isAnthropicModel(model: AIModel): model is AnthropicModel {
  return MODEL_OPTIONS[model].provider === 'anthropic';
}

export function isOpenAIModel(model: AIModel): model is OpenAIModel {
  return MODEL_OPTIONS[model].provider === 'openai';
}
