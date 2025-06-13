import type { Response } from 'express';
import {
  getModelOptions,
  isAnthropicModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isGenAIModel,
  isOpenAIModel,
  isVertexAIAnthropicModel,
  isVertexAIModel,
  isXAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import { DEFAULT_BACKUP_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIMessagePrompt,
  AIModelKey,
  AIRequestHelperArgs,
  ParsedAIResponse,
} from 'quadratic-shared/typesAndSchemasAI';
import { handleAnthropicRequest } from '../../ai/handler/anthropic.handler';
import { handleBedrockRequest } from '../../ai/handler/bedrock.handler';
import { handleOpenAIRequest } from '../../ai/handler/openai.handler';
import { getQuadraticContext, getToolUseContext } from '../../ai/helpers/context.helper';
import { isAzureOpenAIModel } from '../../ai/helpers/openai.helper';
import {
  anthropic,
  azureOpenAI,
  bedrock,
  bedrock_anthropic,
  geminiai,
  openai,
  vertex_anthropic,
  vertexai,
  xai,
} from '../../ai/providers';
import { debugAndNotInProduction, ENVIRONMENT, FINE_TUNE } from '../../env-vars';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';
import { calculateUsage } from '../helpers/usage.helper';
import { handleGenAIRequest } from './genai.handler';

export const handleAIRequest = async (
  modelKey: AIModelKey,
  inputArgs: AIRequestHelperArgs,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  let args = inputArgs;
  try {
    if (args.useToolsPrompt) {
      const toolUseContext = getToolUseContext(args.source);
      args = {
        ...args,
        messages: [...toolUseContext, ...args.messages],
      };
    }

    if (args.useQuadraticContext) {
      const quadraticContext = getQuadraticContext(args.language);
      args = {
        ...args,
        messages: [...quadraticContext, ...args.messages],
      };
    }

    let parsedResponse: ParsedAIResponse | undefined;
    if (isVertexAIAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(modelKey, args, vertex_anthropic, response);
    } else if (isBedrockAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(modelKey, args, bedrock_anthropic, response);
    } else if (isAnthropicModel(modelKey)) {
      parsedResponse = await handleAnthropicRequest(modelKey, args, anthropic, response);
    } else if (isOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(modelKey, args, openai, response);
    } else if (isAzureOpenAIModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(modelKey, args, azureOpenAI, response);
    } else if (isXAIModel(modelKey)) {
      parsedResponse = await handleOpenAIRequest(modelKey, args, xai, response);
    } else if (isVertexAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest(modelKey, args, vertexai, response);
    } else if (isGenAIModel(modelKey)) {
      parsedResponse = await handleGenAIRequest(modelKey, args, geminiai, response);
    } else if (isBedrockModel(modelKey)) {
      parsedResponse = await handleBedrockRequest(modelKey, args, bedrock, response);
    } else {
      throw new Error(`Model not supported: ${modelKey}`);
    }

    if (debugAndNotInProduction && !!parsedResponse) {
      parsedResponse.usage.source = args.source;
      parsedResponse.usage.modelKey = modelKey;
      parsedResponse.usage.cost = calculateUsage(parsedResponse.usage);
      console.log('[AI.Usage]', parsedResponse.usage);
    }

    if (debugAndNotInProduction && FINE_TUNE === 'true' && !!parsedResponse) {
      createFileForFineTuning(modelKey, args, parsedResponse);
    }

    return parsedResponse;
  } catch (error) {
    console.error('Error in handleAIRequest: ', modelKey, error);

    if (
      ENVIRONMENT === 'production' &&
      modelKey !== DEFAULT_BACKUP_MODEL &&
      ['AIAnalyst', 'AIAssistant'].includes(args.source)
    ) {
      return handleAIRequest(DEFAULT_BACKUP_MODEL, args, response);
    }

    const responseMessage: AIMessagePrompt = {
      role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify(error) }],
      contextType: 'userPrompt',
      toolCalls: [],
      modelKey,
    };
    const options = getModelOptions(modelKey, args);
    if (!options.stream || !response?.headersSent) {
      response?.json(responseMessage);
    } else {
      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response?.end();
    }
  }
};
