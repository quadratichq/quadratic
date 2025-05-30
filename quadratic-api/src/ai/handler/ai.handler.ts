import type { Response } from 'express';
import {
  isAnthropicModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isOpenAIModel,
  isVertexAIAnthropicModel,
  isVertexAIModel,
  isXAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import type { AIModelKey, AIRequestHelperArgs, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { handleAnthropicRequest } from '../../ai/handler/anthropic.handler';
import { handleBedrockRequest } from '../../ai/handler/bedrock.handler';
import { handleOpenAIRequest } from '../../ai/handler/openai.handler';
import { handleVertexAIRequest } from '../../ai/handler/vertexai.handler';
import { getQuadraticContext, getToolUseContext } from '../../ai/helpers/context.helper';
import { anthropic, bedrock, bedrock_anthropic, openai, vertex_anthropic, vertexai, xai } from '../../ai/providers';
import { debugAndNotInProduction, FINE_TUNE } from '../../env-vars';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';
import { calculateUsage } from '../helpers/usage.helper';

export const handleAIRequest = async (
  modelKey: AIModelKey,
  args: AIRequestHelperArgs,
  res?: Response
): Promise<ParsedAIResponse | undefined> => {
  if (args.useToolsPrompt) {
    const toolUseContext = getToolUseContext(args.source);
    args.messages.unshift(...toolUseContext);
  }

  if (args.useQuadraticContext) {
    const quadraticContext = getQuadraticContext(args.language);
    args.messages.unshift(...quadraticContext);
  }

  let parsedResponse: ParsedAIResponse | undefined;
  if (isVertexAIAnthropicModel(modelKey)) {
    parsedResponse = await handleAnthropicRequest(modelKey, args, vertex_anthropic, res);
  } else if (isBedrockAnthropicModel(modelKey)) {
    parsedResponse = await handleAnthropicRequest(modelKey, args, bedrock_anthropic, res);
  } else if (isAnthropicModel(modelKey)) {
    parsedResponse = await handleAnthropicRequest(modelKey, args, anthropic, res);
  } else if (isOpenAIModel(modelKey)) {
    parsedResponse = await handleOpenAIRequest(modelKey, args, openai, res);
  } else if (isXAIModel(modelKey)) {
    parsedResponse = await handleOpenAIRequest(modelKey, args, xai, res);
  } else if (isVertexAIModel(modelKey)) {
    parsedResponse = await handleVertexAIRequest(modelKey, args, vertexai, res);
  } else if (isBedrockModel(modelKey)) {
    parsedResponse = await handleBedrockRequest(modelKey, args, bedrock, res);
  } else {
    throw new Error(`Model not supported: ${modelKey}`);
  }

  if (debugAndNotInProduction && !!parsedResponse) {
    parsedResponse.usage.source = args.source;
    parsedResponse.usage.modelKey = modelKey;
    parsedResponse.usage.cost = calculateUsage(parsedResponse.usage);
    console.log('[AI.Usage]', parsedResponse.usage);
  }

  if (debugAndNotInProduction && !!FINE_TUNE && !!parsedResponse) {
    createFileForFineTuning(modelKey, args, parsedResponse);
  }

  return parsedResponse;
};
