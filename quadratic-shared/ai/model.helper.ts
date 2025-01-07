import { MODEL_OPTIONS } from 'quadratic-shared/ai/AI_MODELS';
import type {
  AIAutoCompleteRequestBody,
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

export const getModelOptions = (
  model: AIModel,
  args: Pick<AIAutoCompleteRequestBody, 'useTools' | 'useStream'>
): {
  stream: boolean;
  temperature: number;
  max_tokens: number;
} => {
  const { canStream, canStreamWithToolCalls, temperature, max_tokens } = MODEL_OPTIONS[model];

  const { useTools, useStream } = args;
  const stream = canStream
    ? useTools
      ? canStreamWithToolCalls && (useStream ?? canStream)
      : useStream ?? canStream
    : false;

  return { stream, temperature, max_tokens };
};
