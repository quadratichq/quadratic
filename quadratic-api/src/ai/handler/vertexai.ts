import type { GenerateContentRequest, VertexAI } from '@google-cloud/vertexai';
import { ClientError, GoogleApiError, GoogleAuthError } from '@google-cloud/vertexai';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  ParsedAIResponse,
  VertexAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getVertexAIApiArgs, parseVertexAIResponse, parseVertexAIStream } from '../helpers/vertexai.helper';

const KEEP_ALIVE_INTERVAL = 25000;

export const handleVertexAIRequest = async (
  modelKey: VertexAIModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  vertexai: VertexAI
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getVertexAIApiArgs(args);

  let timeout: NodeJS.Timeout | undefined = undefined;

  try {
    const generativeModel = vertexai.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: options.max_tokens,
        temperature: options.temperature,
      },
      tools,
      toolConfig: tool_choice,
    });

    const apiArgs: GenerateContentRequest = {
      systemInstruction: system,
      contents: messages,
    };

    if (options.stream) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.write(`stream\n\n`);

      // hack to keep stream alive when response takes longer than heroku's 30s timeout
      const keepStreamAlive = () => {
        clearTimeout(timeout);
        if (response.writableEnded) {
          return;
        }
        response.write(`keep alive\n\n`);
        timeout = setTimeout(keepStreamAlive, KEEP_ALIVE_INTERVAL);
      };

      keepStreamAlive();

      const result = await generativeModel.generateContentStream(apiArgs);

      clearTimeout(timeout);

      const parsedResponse = await parseVertexAIStream(result, response, modelKey);
      return parsedResponse;
    } else {
      const result = await generativeModel.generateContent(apiArgs);

      const parsedResponse = parseVertexAIResponse(result, response, modelKey);
      return parsedResponse;
    }
  } catch (error: any) {
    clearTimeout(timeout);

    if (!options.stream || !response.headersSent) {
      if (error instanceof ClientError || error instanceof GoogleApiError || error instanceof GoogleAuthError) {
        const code = 'code' in error ? Number(error.code) : 400;
        response.status(code).json({ error: error.message });
        console.error(code, error.message);
      } else {
        response.status(400).json({ error });
        console.error(error);
      }
    } else {
      const responseMessage: AIMessagePrompt = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text:
              error instanceof ClientError || error instanceof GoogleApiError || error instanceof GoogleAuthError
                ? error.message
                : JSON.stringify(error),
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
