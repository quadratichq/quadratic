import type { Response } from 'express';
import { getLastAIPromptMessageIndex, getLastPromptMessageType } from 'quadratic-shared/ai/helpers/message.helper';
import {
  getModelFromModelKey,
  isAnthropicModel,
  isBedrockAnthropicModel,
  isBedrockModel,
  isOpenAIModel,
  isVertexAIAnthropicModel,
  isVertexAIModel,
  isXAIModel,
} from 'quadratic-shared/ai/helpers/model.helper';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import type { ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';
import { handleAnthropicRequest } from '../../ai/handler/anthropic';
import { handleBedrockRequest } from '../../ai/handler/bedrock';
import { handleOpenAIRequest } from '../../ai/handler/openai';
import { handleVertexAIRequest } from '../../ai/handler/vertexai';
import { getQuadraticContext, getToolUseContext } from '../../ai/helpers/context.helper';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { anthropic, bedrock, bedrock_anthropic, openai, vertex_anthropic, vertexai, xai } from '../../ai/providers';
import dbClient from '../../dbClient';
import { DEBUG, STORAGE_TYPE } from '../../env-vars';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getBucketName, S3Bucket } from '../../storage/s3';
import { uploadFile } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/chat.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/chat.POST.response']>) {
  const {
    user: { id: userId },
  } = req;

  // const usage = await BillingAIUsageMonthlyForUser(userId);
  // const exceededBillingLimit = BillingAIUsageLimitExceeded(usage);

  // if (exceededBillingLimit) {
  //   //@ts-expect-error
  //   return res.status(402).json({ error: 'Billing limit exceeded' });
  // }

  const { body } = parseRequest(req, schema);
  const { chatId, fileUuid, modelKey, ...args } = body;
  const source = args.source;

  // Log the request in OpenAI fine-tuning format
  const fineTuningFormat = {
    messages: args.messages.map((msg) => {
      // Base message with role
      const baseMessage = {
        role: msg.role,
        content: msg.content
          .filter(
            (c): c is { type: 'text'; text: string } => 'type' in c && c.type === 'text' && typeof c.text === 'string'
          )
          .map((c) => c.text)
          .join('\n'),
      };

      // Add tool_calls for assistant messages
      if (msg.role === 'assistant' && msg.contextType === 'userPrompt' && msg.toolCalls?.length > 0) {
        return {
          ...baseMessage,
          tool_calls: msg.toolCalls.map((tool) => ({
            id: tool.id,
            type: 'function',
            function: {
              name: tool.name,
              arguments: tool.arguments,
            },
          })),
        };
      }

      // Add tool responses
      if (msg.role === 'user' && msg.contextType === 'toolResult') {
        return {
          role: 'tool',
          tool_call_id: msg.content[0]?.id,
          content: msg.content[0]?.text || '',
        };
      }

      return baseMessage;
    }),
  };
  console.log('[AI.FineTuningFormat]', JSON.stringify(fineTuningFormat, null, 2));

  if (args.useToolsPrompt) {
    const toolUseContext = getToolUseContext(source);
    args.messages.unshift(...toolUseContext);
  }

  if (args.useQuadraticContext) {
    const quadraticContext = getQuadraticContext(args.language);
    args.messages.unshift(...quadraticContext);
  }

  let parsedResponse: ParsedAIResponse | undefined;
  if (isVertexAIAnthropicModel(modelKey)) {
    parsedResponse = await handleAnthropicRequest(modelKey, args, res, vertex_anthropic);
  } else if (isBedrockAnthropicModel(modelKey)) {
    parsedResponse = await handleAnthropicRequest(modelKey, args, res, bedrock_anthropic);
  } else if (isAnthropicModel(modelKey)) {
    parsedResponse = await handleAnthropicRequest(modelKey, args, res, anthropic);
  } else if (isOpenAIModel(modelKey)) {
    parsedResponse = await handleOpenAIRequest(modelKey, args, res, openai);
  } else if (isXAIModel(modelKey)) {
    parsedResponse = await handleOpenAIRequest(modelKey, args, res, xai);
  } else if (isVertexAIModel(modelKey)) {
    parsedResponse = await handleVertexAIRequest(modelKey, args, res, vertexai);
  } else if (isBedrockModel(modelKey)) {
    parsedResponse = await handleBedrockRequest(modelKey, args, res, bedrock);
  } else {
    throw new Error(`Model not supported: ${modelKey}`);
  }
  if (parsedResponse) {
    args.messages.push(parsedResponse.responseMessage);

    // Log the complete conversation in OpenAI fine-tuning format
    const completedFineTuningFormat = {
      messages: args.messages.map((msg) => ({
        role: msg.role,
        content: msg.content
          .map((c) => {
            if ('text' in c && typeof c.text === 'string') {
              return c.text;
            }
            return '';
          })
          .join('\n'),
      })),
    };
    console.log('[AI.CompletedConversation]', JSON.stringify(completedFineTuningFormat, null, 2));
  }

  if (DEBUG) {
    console.log('[AI.TokenUsage]', parsedResponse?.usage);
  }

  const {
    file: { id: fileId, ownerTeam },
  } = await getFile({ uuid: fileUuid, userId });

  const model = getModelFromModelKey(modelKey);
  const messageIndex = getLastAIPromptMessageIndex(args.messages);
  const messageType = getLastPromptMessageType(args.messages);

  const chat = await dbClient.analyticsAIChat.upsert({
    where: {
      chatId,
    },
    create: {
      userId,
      fileId,
      chatId,
      source,
      messages: {
        create: {
          model,
          messageIndex,
          messageType,
          inputTokens: parsedResponse?.usage.inputTokens,
          outputTokens: parsedResponse?.usage.outputTokens,
          cacheReadTokens: parsedResponse?.usage.cacheReadTokens,
          cacheWriteTokens: parsedResponse?.usage.cacheWriteTokens,
        },
      },
    },
    update: {
      messages: {
        create: {
          model,
          messageIndex,
          messageType,
          inputTokens: parsedResponse?.usage.inputTokens,
          outputTokens: parsedResponse?.usage.outputTokens,
          cacheReadTokens: parsedResponse?.usage.cacheReadTokens,
          cacheWriteTokens: parsedResponse?.usage.cacheWriteTokens,
        },
      },
      updatedDate: new Date(),
    },
  });

  // Save the data to s3
  try {
    if (ownerTeam.settingAnalyticsAi) {
      const key = `${fileUuid}-${source}_${chatId.replace(/-/g, '_')}_${messageIndex}.json`;

      // If we aren't using s3 or the analytics bucket name is not set, don't save the data
      // This path is also used for self-hosted users, so we don't want to save the data in that case
      if (STORAGE_TYPE !== 's3' || !getBucketName(S3Bucket.ANALYTICS)) {
        return;
      }

      const jwt = req.header('Authorization');
      if (!jwt) {
        return;
      }

      const contents = Buffer.from(JSON.stringify(args)).toString('base64');
      const response = await uploadFile(key, contents, jwt, S3Bucket.ANALYTICS);
      const s3Key = response.key;

      await dbClient.analyticsAIChatMessage.update({
        where: {
          chatId_messageIndex: { chatId: chat.id, messageIndex },
        },
        data: { s3Key },
      });
    }
  } catch (e) {
    console.error(e);
  }
}
