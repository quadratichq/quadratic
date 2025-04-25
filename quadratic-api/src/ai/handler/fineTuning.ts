import type { Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import type { AIRequestHelperArgs, ModelKey, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs } from '../helpers/openai.helper';

export const createFileForFineTuning = (
  response: Response,
  modelKey: ModelKey,
  args: AIRequestHelperArgs,
  parsedResponse: ParsedAIResponse
) => {
  const model = getModelFromModelKey(modelKey);

  const copyArgs = { ...args };
  const copyResponse = { ...parsedResponse.responseMessage };
  copyArgs.messages.push({ ...copyResponse });
  const { messages, tools } = getOpenAIApiArgs(args, true);
  const fineTuningInput = {
    messages,
    ...(tools ? { functions: tools.map((tool) => tool.function) } : {}),
  };
  copyResponse.fineTuningInput = JSON.stringify(fineTuningInput);

  // send back to client with fine tuning input
  response.write(`data: ${JSON.stringify(copyResponse)}\n\n`);
  if (!response.writableEnded) {
    response.end();
  }

  // write local file at quadratic/finetuning/<model>_<timestamp>.json
  const dirPath = path.join(__dirname, '../../../../finetuning');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(path.join(dirPath, `${model}_${Date.now()}.json`), JSON.stringify(fineTuningInput, null, 2));
};
