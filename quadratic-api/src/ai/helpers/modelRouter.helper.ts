import {
  getLastAIPromptMessageModelKey,
  getPromptMessagesForAI,
  isContentText,
} from 'quadratic-shared/ai/helpers/message.helper';
import { isQuadraticModel } from 'quadratic-shared/ai/helpers/model.helper';
import {
  DEFAULT_BACKUP_MODEL,
  DEFAULT_MODEL_FREE,
  DEFAULT_MODEL_ROUTER_MODEL,
  DEFAULT_SQL_MODEL,
  DEFAULT_SQL_MODEL_THINKING,
  MODELS_CONFIGURATION,
} from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec, MODELS_ROUTER_CONFIGURATION } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey, AIRequestHelperArgs } from 'quadratic-shared/typesAndSchemasAI';
import { handleAIRequest } from '../handler/ai.handler';

export const getModelKey = async (
  modelKey: AIModelKey,
  inputArgs: AIRequestHelperArgs,
  isOnPaidPlan: boolean,
  exceededBillingLimit: boolean
): Promise<AIModelKey> => {
  try {
    if (!['AIAnalyst', 'AIAssistant'].includes(inputArgs.source)) {
      return modelKey;
    }

    if (!isOnPaidPlan) {
      return DEFAULT_MODEL_FREE;
    }

    if (inputArgs.source === 'AIAssistant' && inputArgs.language === 'Connection') {
      const thinking = MODELS_CONFIGURATION[modelKey].thinking;
      return thinking ? DEFAULT_SQL_MODEL_THINKING : DEFAULT_SQL_MODEL;
    }

    if (!isQuadraticModel(modelKey)) {
      return modelKey;
    }

    const messages = inputArgs.messages;
    if (messages.length === 0) {
      throw new Error('No messages provided');
    }

    const promptMessages = getPromptMessagesForAI(messages);
    const lastPromptMessage = promptMessages[promptMessages.length - 1];
    if (lastPromptMessage.role !== 'user' || lastPromptMessage.contextType !== 'userPrompt') {
      return getLastAIPromptMessageModelKey(promptMessages) ?? DEFAULT_BACKUP_MODEL;
    }

    const userTextPrompt = lastPromptMessage.content
      .filter(isContentText)
      .map((content) => content.text)
      .join('\n')
      .trim();

    if (!userTextPrompt) {
      return DEFAULT_BACKUP_MODEL;
    }

    const args: AIRequestHelperArgs = {
      source: 'ModelRouter',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
 <role>
  You are an AI model selector for a spreadsheet application. Based on the user's prompt, choose the most suitable model.
 </role>

 <models>
  <model name="Claude">
   <capabilities>
    <capability>Creating sample data</capability>
    <capability>Creating calculators</capability>
    <capability>Creating new charts</capability>
    <capability>Editing existing charts</capability>
    <capability>Requests that involve frustration</capability>
    <capability>Onboarding questions</capability>
    <capability>Data cleaning</capability>
    <capability>Augmenting data</capability>
    <capability>Processing images and PDFs</capability>
    <capability>Writing JavaScript</capability>
    <capability>Conditional formatting</capability>
    <capability>Charts that have problems</capability>
    <capability>API requests</capability>
    <capability>Any capabilities not defined in these instructions</capability>
    <capability>Requests that involve frustration</capability>
    <capability>Charts that have problems</capability>
   </capabilities>
  </model>
  <model name="4.1">
   <capabilities>
    <capability>Simple/explicitly defined formatting</capability>
    <capability>Moving data to specific cell locations</capability>
   </capabilities>
  </model>
 </models>

 <instructions>
  Only respond with the model name: "Claude" or "4.1". Do not include any additional text, explanations, or formatting.
 </instructions>

 <examples>
  <example>
   <user>Insert some sample manufacturing data</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>create a dataset of sales data</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Create a debt snowball calculator</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Create a mortgage calculator</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Hi, I'm new to Quadratic.</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Analyze my PDFs</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Highlight all the cells with value > 50</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>change text color to blue in all the rows that have gender male</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Remove column B from the data</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>How much does each crop produce per year?</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Highlight all male entries orange</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Add an extra axis to my chart</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Change the line to blue</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Create a chart</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Highlight column C blue</user>
   <answer>4.1</answer>
  </example>
  <example>
   <user>Find the mean, filtered by product type</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Sum the values in column F</user>
   <answer>Claude</answer>
  </example>
  <example>
    <user>Calculate the mean of costs</user>
    <answer>Claude</answer>
  </example>
  <example>
   <user>move that to A9</user>
   <answer>4.1</answer>
  </example>
  <example>
   <user>That chart has an issue</user>
   <answer>Claude</answer>
  </example>
    <example>
   <user>try again</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Why do you keep failing?</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Chart is empty or missing data</user>
   <answer>Claude</answer>
  </example>
 </examples>
`,
            },
          ],
          contextType: 'modelRouter',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Choose the most suitable model for the following prompt:
${userTextPrompt}
`,
            },
          ],
          contextType: 'userPrompt',
        },
      ],
      useStream: false,
      toolName: AITool.SetAIModel,
      useToolsPrompt: false,
      language: undefined,
      useQuadraticContext: false,
    };

    const parsedResponse = await handleAIRequest(DEFAULT_MODEL_ROUTER_MODEL, args, isOnPaidPlan, exceededBillingLimit);

    const setAIModelToolCall = parsedResponse?.responseMessage.toolCalls.find(
      (toolCall) => toolCall.name === AITool.SetAIModel
    );
    if (setAIModelToolCall) {
      const argsObject = JSON.parse(setAIModelToolCall.arguments);
      const { ai_model } = aiToolsSpec[AITool.SetAIModel].responseSchema.parse(argsObject);
      return MODELS_ROUTER_CONFIGURATION[ai_model];
    }
  } catch (error) {
    console.error('Error in getModelKey: ', error);
  }

  return DEFAULT_BACKUP_MODEL;
};
