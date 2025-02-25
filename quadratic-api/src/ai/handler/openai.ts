import { type Response } from 'express';
import OpenAI from 'openai';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type {
  AIMessagePrompt,
  AIRequestHelperArgs,
  OpenAIModelKey,
  XAIModelKey,
} from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from '../helpers/openai.helper';

export const handleOpenAIRequest = async (
  modelKey: OpenAIModelKey | XAIModelKey,
  args: AIRequestHelperArgs,
  response: Response,
  openai: OpenAI
): Promise<AIMessagePrompt | undefined> => {
  const options = getModelOptions(modelKey, args);
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args, options.strickParams);

  if (options.stream) {
    try {
      const completion = await openai.chat.completions.create({
        model: MODELS_CONFIGURATION[modelKey].model,
        messages,
        temperature: options.temperature,
        stream: options.stream,
        tools,
        tool_choice,
      });

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const responseMessage = await parseOpenAIStream(completion, response, modelKey);
      return responseMessage;
    } catch (error: any) {
      if (!response.headersSent) {
        if (error instanceof OpenAI.APIError) {
          response.status(error.status ?? 400).json(error.message);
          console.log(error.status, error.message);
        } else {
          response.status(400).json(error);
          console.log(error);
        }
      } else {
        console.error('Error occurred after headers were sent:', error);
      }
    }
  } else {
    try {
      const result = await openai.chat.completions.create({
        model: MODELS_CONFIGURATION[modelKey].model,
        messages,
        temperature: options.temperature,
        stream: options.stream,
        tools,
        tool_choice,
      });
      const responseMessage = parseOpenAIResponse(result, response, modelKey);
      return responseMessage;
    } catch (error: any) {
      if (error instanceof OpenAI.APIError) {
        response.status(error.status ?? 400).json(error.message);
        console.log(error.status, error.message);
      } else {
        response.status(400).json(error);
        console.log(error);
      }
    }
  }
};
