import type AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  ThinkingConfigParam,
} from '@anthropic-ai/sdk/resources';
import type { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  AnthropicModelKey,
  BedrockAnthropicModelKey,
  ParsedAIResponse,
  VertexAIAnthropicModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from '../helpers/anthropic.helper';
import { createFileForFineTuning } from '../helpers/fineTuning.helper';

export const handleAnthropicRequest = async (
  modelKey: VertexAIAnthropicModelKey | BedrockAnthropicModelKey | AnthropicModelKey,
  args: AIRequestHelperArgs,
  anthropic: AnthropicVertex | AnthropicBedrock | Anthropic,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getAnthropicApiArgs(args, options.promptCaching, options.thinking);

  const thinking: ThinkingConfigParam = options.thinking
    ? {
        type: 'enabled',
        budget_tokens: options.max_tokens * 0.75,
      }
    : {
        type: 'disabled',
      };

  try {
    let apiArgs: MessageCreateParamsStreaming | MessageCreateParamsNonStreaming = {
      model,
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
    if (options.stream) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
      response?.write(`stream\n\n`);

      const chunks = await anthropic.messages.create(apiArgs as MessageCreateParamsStreaming);

      const parsedResponse = await parseAnthropicStream(chunks, modelKey, response);

      createFileForFineTuning(modelKey, args, parsedResponse, response);

      return parsedResponse;
    } else {
      const result = await anthropic.messages.create(apiArgs as MessageCreateParamsNonStreaming);

      const parsedResponse = parseAnthropicResponse(result, modelKey, response);
      return parsedResponse;
    }
  } catch (error: any) {
    if (!options.stream || !response?.headersSent) {
      if (error instanceof Anthropic.APIError) {
        response?.status(error.status ?? 400).json({ error: error.message });
        console.error(error.status, error.message);
      } else {
        response?.status(400).json({ error });
        console.error(error);
      }
    } else {
      const responseMessage: AIMessagePrompt = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: error instanceof Anthropic.APIError ? error.message : JSON.stringify(error),
          },
        ],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey,
      };
      response?.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response?.end();
      console.error('Error occurred after headers were sent:', error);
    }
  }
};
