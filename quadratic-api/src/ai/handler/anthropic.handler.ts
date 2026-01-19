import type AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  ThinkingConfigParam,
} from '@anthropic-ai/sdk/resources';
import type { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AnthropicModelKey,
  BedrockAnthropicModelKey,
  ParsedAIResponse,
  VertexAIAnthropicModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getAnthropicApiArgs, parseAnthropicResponse, parseAnthropicStream } from '../helpers/anthropic.helper';
import type { HandleAIRequestArgs } from './ai.handler';

interface HandleAnthropicRequestArgs extends Omit<HandleAIRequestArgs, 'modelKey'> {
  modelKey: VertexAIAnthropicModelKey | BedrockAnthropicModelKey | AnthropicModelKey;
  anthropic: AnthropicVertex | AnthropicBedrock | Anthropic;
}
export const handleAnthropicRequest = async ({
  modelKey,
  args,
  isOnPaidPlan,
  exceededBillingLimit,
  response,
  signal,
  anthropic,
}: HandleAnthropicRequestArgs): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getAnthropicApiArgs(
    args,
    options.aiModelMode,
    options.promptCaching,
    options.thinking
  );

  const thinking: ThinkingConfigParam = options.thinking
    ? {
        type: 'enabled',
        budget_tokens: options.max_tokens * 0.75,
      }
    : {
        type: 'disabled',
      };

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
    if (!response?.headersSent) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
      response?.write(`stream\n\n`);
    }

    const chunks = await anthropic.messages.create(apiArgs as MessageCreateParamsStreaming, { signal });
    const parsedResponse = await parseAnthropicStream(chunks, modelKey, isOnPaidPlan, exceededBillingLimit, response);
    return parsedResponse;
  } else {
    const result = await anthropic.messages.create(apiArgs as MessageCreateParamsNonStreaming, { signal });
    const parsedResponse = parseAnthropicResponse(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
    return parsedResponse;
  }
};
