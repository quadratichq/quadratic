import type { GenerateContentRequest, VertexAI } from '@google-cloud/vertexai';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, ParsedAIResponse, VertexAIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { getVertexAIApiArgs, parseVertexAIResponse, parseVertexAIStream } from '../helpers/vertexai.helper';

const KEEP_ALIVE_INTERVAL = 25000;

export const handleVertexAIRequest = async (
  modelKey: VertexAIModelKey,
  args: AIRequestHelperArgs,
  vertexai: VertexAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getVertexAIApiArgs(args);

  let timeout: NodeJS.Timeout | undefined = undefined;

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
    if (!response?.headersSent) {
      response?.setHeader('Content-Type', 'text/event-stream');
      response?.setHeader('Cache-Control', 'no-cache');
      response?.setHeader('Connection', 'keep-alive');
    }
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

    const result = await generativeModel.generateContentStream(apiArgs);

    clearTimeout(timeout);

    const parsedResponse = await parseVertexAIStream(result, modelKey, response);
    return parsedResponse;
  } else {
    const result = await generativeModel.generateContent(apiArgs);
    const parsedResponse = parseVertexAIResponse(result, modelKey, response);
    return parsedResponse;
  }
};
