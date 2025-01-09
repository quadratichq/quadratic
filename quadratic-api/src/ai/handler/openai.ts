import { type Response } from 'express';
import OpenAI from 'openai';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from 'quadratic-api/src/ai/helpers/openai.helper';
import { OPENAI_API_KEY } from 'quadratic-api/src/env-vars';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIMessagePrompt, AIRequestBody, OpenAIModel } from 'quadratic-shared/typesAndSchemasAI';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
});

export const handleOpenAIRequest = async (
  model: OpenAIModel,
  args: Omit<AIRequestBody, 'model'>,
  response: Response
): Promise<AIMessagePrompt | undefined> => {
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args);
  const { stream, temperature } = getModelOptions(model, args);

  if (stream) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        stream: true,
        tools,
        tool_choice,
      });

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      const responseMessage = await parseOpenAIStream(completion, response, model);
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
        model,
        messages,
        temperature,
        tools,
        tool_choice,
      });
      const responseMessage = parseOpenAIResponse(result, response, model);
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
