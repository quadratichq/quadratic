import { type Response } from 'express';
import OpenAI from 'openai';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import {
  type AIAutoCompleteRequestBody,
  type AIMessagePrompt,
  type OpenAIModel,
} from 'quadratic-shared/typesAndSchemasAI';
import { OPENAI_API_KEY } from '../../env-vars';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from './helpers/openai.helper';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
});

export const handleOpenAIRequest = async (
  model: OpenAIModel,
  args: Omit<AIAutoCompleteRequestBody, 'model'>,
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

      const responseMessage = await parseOpenAIStream(completion, response);
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
      const responseMessage = parseOpenAIResponse(result, response);
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
