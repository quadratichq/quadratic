import fs from 'node:fs';
import path from 'node:path';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelKey, AIRequestHelperArgs, ParsedAIResponse } from 'quadratic-shared/typesAndSchemasAI';
import { getOpenAIApiArgs } from '../helpers/openai.helper';

export const createFileForFineTuning = (
  modelKey: AIModelKey,
  args: AIRequestHelperArgs,
  parsedResponse: ParsedAIResponse
) => {
  const model = getModelFromModelKey(modelKey);

  const copyArgs = { ...args };
  const copyResponse = { ...parsedResponse.responseMessage };
  copyArgs.messages.push({ ...copyResponse });
  const aiModelMode = MODELS_CONFIGURATION[modelKey].mode;
  const { messages, tools } = getOpenAIApiArgs(copyArgs, aiModelMode, true, true);
  const fineTuningInput = {
    messages,
    ...(tools ? { tools } : {}),
  };

  // write local file at quadratic/finetuning/<model>_<timestamp>.json
  const dirPath = path.join(__dirname, '../../../../finetuning');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(path.join(dirPath, `${model}_${Date.now()}.json`), JSON.stringify(fineTuningInput, null, 2));
};
