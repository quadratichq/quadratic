import { AI } from '@/shared/constants/routes';
import { AIModel } from 'quadratic-shared/typesAndSchemasAI';
import { isAnthropicBedrockModel, isAnthropicModel, isBedrockModel, isOpenAIModel } from './model.helper';

export function getAIProviderEndpoint(model: AIModel, stream: boolean): string {
  if (isBedrockModel(model)) {
    return stream ? AI.BEDROCK.STREAM : AI.BEDROCK.CHAT;
  }
  if (isAnthropicBedrockModel(model)) {
    return stream ? AI.BEDROCK.ANTHROPIC.STREAM : AI.BEDROCK.ANTHROPIC.CHAT;
  }
  if (isAnthropicModel(model)) {
    return stream ? AI.ANTHROPIC.STREAM : AI.ANTHROPIC.CHAT;
  }
  if (isOpenAIModel(model)) {
    return stream ? AI.OPENAI.STREAM : AI.OPENAI.CHAT;
  }
  throw new Error(`Unknown model: ${model}`);
}
