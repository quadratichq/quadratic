import type { GenerateContentRequest, VertexAI } from '@google-cloud/vertexai';
import { ClientError, GoogleApiError, GoogleAuthError } from '@google-cloud/vertexai';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, ParsedAIResponse, VertexAIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { getVertexAIApiArgs, parseVertexAIResponse, parseVertexAIStream } from '../helpers/vertexai.helper';

export const handleVertexAIRequest = async (
  modelKey: VertexAIModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  vertexai: VertexAI
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getVertexAIApiArgs(args);

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
      const result = await generativeModel.generateContentStream(apiArgs);

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      return await parseVertexAIStream(result, response, modelKey);
    } else {
      const result = await generativeModel.generateContent(apiArgs);
      return parseVertexAIResponse(result, response, modelKey);
    }
  } catch (error: any) {
    if (!options.stream || !response.headersSent) {
      if (error instanceof ClientError || error instanceof GoogleApiError || error instanceof GoogleAuthError) {
        const code = 'code' in error ? Number(error.code) : 400;
        const errorMessage = error.message || 'Unknown Google API error';
        const errorDetails =
          error instanceof GoogleAuthError ? 'Authentication failed. Please check your GCP credentials.' : errorMessage;
        response.status(code).json({ error: errorDetails });
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        response.status(error.response.status).json({
          error: 'Authentication failed. Please check your GCP credentials and permissions.',
        });
      } else {
        response.status(400).json({
          error: 'Failed to process request',
        });
      }
    } else {
      response.end();
    }
  }
};
