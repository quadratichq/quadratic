import { type Response } from 'express';
import OpenAI from 'openai';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIMessagePrompt, AIRequestHelperArgs, OpenAIModel, XAIModel } from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs, parseOpenAIResponse, parseOpenAIStream } from '../helpers/openai.helper';

export const handleOpenAIRequest = async (
  model: OpenAIModel | XAIModel,
  args: AIRequestHelperArgs,
  response: Response,
  openai: OpenAI
): Promise<AIMessagePrompt | undefined> => {
  const options = getModelOptions(model, args);
  const { messages, tools, tool_choice } = getOpenAIApiArgs(args, options.strickParams);

  if (options.stream) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature,
        stream: options.stream,
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
        temperature: options.temperature,
        stream: options.stream,
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
