import type { GenerateContentParameters, GoogleGenAI } from '@google/genai';
import type { Response } from 'express';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type {
  AIRequestHelperArgs,
  GeminiAIModelKey,
  ParsedAIResponse,
  VertexAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getGenAIApiArgs, parseGenAIResponse, parseGenAIStream } from '../helpers/genai.helper';

const KEEP_ALIVE_INTERVAL = 25000;

export const handleGenAIRequest = async (
  modelKey: VertexAIModelKey | GeminiAIModelKey,
  args: AIRequestHelperArgs,
  genai: GoogleGenAI,
  response?: Response
): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getGenAIApiArgs(args);

  const apiArgs: GenerateContentParameters = {
    model,
    contents: messages,
    config: {
      temperature: options.temperature,
      systemInstruction: system,
      maxOutputTokens: options.max_tokens,
      tools,
      toolConfig: tool_choice,
      thinkingConfig: {
        includeThoughts: options.thinking,
        thinkingBudget: options.thinkingBudget,
      },
    },
  };

  if (options.stream) {
    response?.setHeader('Content-Type', 'text/event-stream');
    response?.setHeader('Cache-Control', 'no-cache');
    response?.setHeader('Connection', 'keep-alive');
    response?.write(`stream\n\n`);

    // hack to keep stream alive when response takes longer than heroku's 30s timeout
    let timeout: NodeJS.Timeout | undefined = undefined;
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
};
