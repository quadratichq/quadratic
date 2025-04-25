import type { BedrockRuntimeClient, ConverseRequest, ConverseStreamRequest } from '@aws-sdk/client-bedrock-runtime';
import { ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  BedrockModelKey,
  ParsedAIResponse,
} from 'quadratic-shared/typesAndSchemasAI';
import { getBedrockApiArgs, parseBedrockResponse, parseBedrockStream } from '../helpers/bedrock.helper';
import { createFileForFineTuning } from './fineTuning';

export const handleBedrockRequest = async (
  modelKey: BedrockModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  bedrock: BedrockRuntimeClient
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getBedrockApiArgs(args);

  try {
    const apiArgs: ConverseStreamRequest | ConverseRequest = {
      modelId: model,
      system,
      messages,
      inferenceConfig: { maxTokens: options.max_tokens, temperature: options.temperature },
      toolConfig: tools &&
        tool_choice && {
          tools,
          toolChoice: tool_choice,
        },
    };

    if (options.stream) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.write(`stream\n\n`);

      const command = new ConverseStreamCommand(apiArgs);
      const chunks = (await bedrock.send(command)).stream ?? [];

      const parsedResponse = await parseBedrockStream(chunks, response, modelKey);

      createFileForFineTuning(response, modelKey, args, parsedResponse);

      return parsedResponse;
    } else {
      const command = new ConverseCommand(apiArgs);

      const result = await bedrock.send(command);
      const parsedResponse = parseBedrockResponse(result, response, modelKey);
      return parsedResponse;
    }
  } catch (error: any) {
    if (!options.stream || !response.headersSent) {
      response.status(400).json({ error });
      console.error(error);
    } else {
      const responseMessage: AIMessagePrompt = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify(error),
          },
        ],
        contextType: 'userPrompt',
        toolCalls: [],
        model: getModelFromModelKey(modelKey),
      };
      response.write(`data: ${JSON.stringify(responseMessage)}\n\n`);
      response.end();
      console.error('Error occurred after headers were sent:', error);
    }
  }
};
