import type { GenerateContentParameters, GoogleGenAI } from '@google/genai';
import { getModelFromModelKey, getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { GeminiAIModelKey, ParsedAIResponse, VertexAIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { getGenAIApiArgs, parseGenAIResponse, parseGenAIStream } from '../helpers/genai.helper';
import type { HandleAIRequestArgs } from './ai.handler';

interface HandleGenAIRequestArgs extends Omit<HandleAIRequestArgs, 'modelKey'> {
  modelKey: VertexAIModelKey | GeminiAIModelKey;
  genai: GoogleGenAI;
}
export const handleGenAIRequest = async ({
  modelKey,
  args,
  isOnPaidPlan,
  exceededBillingLimit,
  response,
  signal,
  genai,
}: HandleGenAIRequestArgs): Promise<ParsedAIResponse | undefined> => {
  const model = getModelFromModelKey(modelKey);
  const options = getModelOptions(modelKey, args);
  const { system, messages, tools, tool_choice } = getGenAIApiArgs(args, options.aiModelMode);

  const apiArgs: GenerateContentParameters = {
    model,
    contents: messages,
    config: {
      temperature: options.temperature,
      systemInstruction: system,
      maxOutputTokens: !options.max_tokens ? undefined : options.max_tokens,
      tools,
      toolConfig: tool_choice,
      ...(options.thinkingLevel !== undefined
        ? {
            thinkingConfig: {
              thinking_level: options.thinkingLevel,
            },
          }
        : options.thinking !== undefined && {
            thinkingConfig: {
              includeThoughts: options.thinking,
              thinkingBudget: options.thinkingBudget,
            },
          }),
      abortSignal: signal,
    },
  };

  if (options.stream) {
    response?.setHeader('Content-Type', 'text/event-stream');
    response?.setHeader('Cache-Control', 'no-cache');
    response?.setHeader('Connection', 'keep-alive');
    response?.write(`stream\n\n`);

    const result = await genai.models.generateContentStream(apiArgs);

    const parsedResponse = await parseGenAIStream(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
    return parsedResponse;
  } else {
    const result = await genai.models.generateContent(apiArgs);

    const parsedResponse = parseGenAIResponse(result, modelKey, isOnPaidPlan, exceededBillingLimit, response);
    return parsedResponse;
  }
};
