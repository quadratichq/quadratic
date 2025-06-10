import { ClientError, GoogleApiError, GoogleAuthError } from '@google-cloud/vertexai';
import type { GenerateContentParameters, GoogleGenAI } from '@google/genai';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  GenAIModelKey,
  ParsedAIResponse,
} from 'quadratic-shared/typesAndSchemasAI';
import { getGenAIApiArgs, parseGenAIResponse, parseGenAIStream } from '../helpers/genai.helper';

const KEEP_ALIVE_INTERVAL = 25000;

export const handleGenAIRequest = async (
  modelKey: GenAIModelKey,
  args: AIRequestHelperArgs,
  genai: GoogleGenAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getGenAIApiArgs(args);

  let timeout: NodeJS.Timeout | undefined = undefined;

  try {
    const apiArgs: GenerateContentParameters = {
      model,
      contents: messages,
      config: {
        temperature: options.temperature,
        systemInstruction: system,
        maxOutputTokens: options.max_tokens,
        tools,
        toolConfig: tool_choice,
        ...(options.thinking && {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: 32768, // Set a reasonable thinking budget for more responsive streaming
          },
        }),
      },
    };

    if (options.stream) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
      response?.write(`stream\n\n`);

      // hack to keep stream alive when response takes longer than heroku's 30s timeout
      const keepStreamAlive = () => {
        clearTimeout(timeout);
        if (response?.writableEnded) {
          return;
        }
        response?.write(`keep alive\n\n`);
        timeout = setTimeout(keepStreamAlive, KEEP_ALIVE_INTERVAL);
      };

      keepStreamAlive();

      const result = await genai.models.generateContentStream(apiArgs);

      clearTimeout(timeout);

      const parsedResponse = await parseGenAIStream(result, modelKey, response);
      return parsedResponse;
    } else {
      const result = await genai.models.generateContent(apiArgs);

      const parsedResponse = parseGenAIResponse(result, modelKey, response);
      return parsedResponse;
    }
  } catch (error: any) {
    clearTimeout(timeout);

    console.error(error);

    if (!options.stream || !response?.headersSent) {
      if (error instanceof ClientError || error instanceof GoogleApiError || error instanceof GoogleAuthError) {
        const code = 'code' in error ? Number(error.code) : 400;
        response?.status(code).json({ error: error.message });
        console.error(code, error.message);
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
            text:
              error instanceof ClientError || error instanceof GoogleApiError || error instanceof GoogleAuthError
                ? error.message
                : JSON.stringify(error),
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
