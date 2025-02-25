import type AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  ThinkingConfigParam,
} from '@anthropic-ai/sdk/resources';
import type { Response } from 'express';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AnthropicModelKey,
  BedrockAnthropicModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from '../helpers/anthropic.helper';

export const handleAnthropicRequest = async (
  modelKey: BedrockAnthropicModelKey | AnthropicModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  anthropic: AnthropicBedrock | Anthropic
): Promise<AIMessagePrompt | undefined> => {
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getAnthropicApiArgs(args, options.thinking);

  const thinking: ThinkingConfigParam = options.thinking
    ? {
        type: 'enabled',
        budget_tokens: options.max_tokens * 0.75,
      }
    : {
        type: 'disabled',
      };

  if (options.stream) {
    try {
      let apiArgs: MessageCreateParamsStreaming = {
        model: MODELS_CONFIGURATION[modelKey].model,
        system,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
        tools,
        tool_choice,
      };
      if (options.thinking !== undefined) {
        apiArgs = {
          ...apiArgs,
          thinking,
        };
      }

      const chunks = await anthropic.messages.create(apiArgs);

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const responseMessage = await parseAnthropicStream(chunks, response, modelKey);
      return responseMessage;
    } catch (error: any) {
      if (!response.headersSent) {
        if (error instanceof Anthropic.APIError) {
          response.status(error.status ?? 400).json(error.message);
          console.log(error.status, error.message);
        } else {
          response.status(400).json(error);
          console.log(error);
        }
      } else {
        console.error('Error occurred after headers were sent:', error);
      }
    }
  } else {
    try {
      let apiArgs: MessageCreateParamsNonStreaming = {
        model: MODELS_CONFIGURATION[modelKey].model,
        system,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
        tools,
        tool_choice,
      };
      if (options.thinking !== undefined) {
        apiArgs = {
          ...apiArgs,
          thinking,
        };
      }

      const result = await anthropic.messages.create(apiArgs);

      const responseMessage = parseAnthropicResponse(result, response, modelKey);
      return responseMessage;
    } catch (error: any) {
      if (error instanceof Anthropic.APIError) {
        response.status(error.status ?? 400).json(error.message);
        console.log(error.status, error.message);
      } else {
        response.status(400).json(error);
        console.log(error);
      }
    }
  }
};
