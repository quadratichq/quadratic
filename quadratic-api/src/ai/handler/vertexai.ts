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

    const requestArgs: GenerateContentRequest = {
      systemInstruction: system,
      contents: messages,
    };

    if (options.stream) {
      const result = await generativeModel.generateContentStream(requestArgs);

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const parsedResponse = await parseVertexAIStream(result, response, modelKey);
      return parsedResponse;
    } else {
      const result = await generativeModel.generateContent(requestArgs);

      const parsedResponse = parseVertexAIResponse(result, response, modelKey);
      return parsedResponse;
    }
  } catch (error: any) {
    if (!options.stream || !response.headersSent) {
      if (error instanceof ClientError || error instanceof GoogleApiError || error instanceof GoogleAuthError) {
        const code = 'code' in error ? Number(error.code) : 400;
        response.status(code).json({ error: error.message });
        console.log(code, error.message);
      } else {
        response.status(400).json({ error });
        console.log(error);
      }
    } else {
      response.end();
      console.log('Error occurred after headers were sent:', error);
    }
  }
};
