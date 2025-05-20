import {
  getLastAIPromptMessageModelKey,
  getPromptMessages,
  isContentText,
} from 'quadratic-shared/ai/helpers/message.helper';
import { isQuadraticModel } from 'quadratic-shared/ai/helpers/model.helper';
import {
  DEFAULT_BACKUP_MODEL,
  DEFAULT_MODEL_ROUTER_MODEL,
  DEFAULT_SQL_MODEL,
  DEFAULT_SQL_MODEL_THINKING,
  MODELS_CONFIGURATION,
} from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec, MODELS_ROUTER_CONFIGURATION } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey, AIRequestHelperArgs } from 'quadratic-shared/typesAndSchemasAI';
import { handleAIRequest } from '../handler/ai.handler';

export const getModelKey = async (modelKey: AIModelKey, inputArgs: AIRequestHelperArgs): Promise<AIModelKey> => {
  try {
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

    const promptMessages = getPromptMessages(messages);
    const lastPromptMessage = promptMessages[promptMessages.length - 1];
    if (lastPromptMessage.role !== 'user' || lastPromptMessage.contextType !== 'userPrompt') {
      return getLastAIPromptMessageModelKey(promptMessages) ?? DEFAULT_BACKUP_MODEL;
    }

    const userTextPrompt = lastPromptMessage.content
      .filter(isContentText)
      .map((content) => content.text)
      .join('\n');

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
  You are an AI model selector for a data analysis application. Based on the user's prompt, choose the most suitable model.
 </role>

 <models>
  <model name="Claude">
   <capabilities>
    <capability>Conditional formatting</capability>
    <capability>Handling prompts that involve frustration</capability>
    <capability>Processing images and PDFs</capability>
   </capabilities>
  </model>
  <model name="Flash">
   <capabilities>
    <capability>Creating simple formulas for the most basic calculations</capability>
    <capability>Any explicit formula request</capability>
    <capability>Simple formatting</capability>
   </capabilities>
  </model>
  <model name="GPT-4.1-mini">
   <capabilities>
    <capability>Code and data analysis tasks - charting, summarizing, correlations, api requests, etc.</capability>
    <capability>Requests to repeat that don't make it clear it didn't work</capability>
    <capability>Calculations that are best solved by code</capability>
    <capability>Calculations of any relative complexity</capability>
   </capabilities>
  </model>
 </models>

 <instructions>
  Only respond with the model name: "Claude" or "Flash" or "GPT-4.1-mini". Do not include any additional text, explanations, or formatting.
 </instructions>

 <examples>
  <example>
   <user>Insert some sample manufacturing data</user>
   <answer>GPT-4.1-mini</answer>
  </example>
  <example>
   <user>Create a chart</user>
   <answer>GPT-4.1-mini</answer>
  </example>
  <example>
   <user>Add an extra axis to my chart</user>
   <answer>GPT-4.1-mini</answer>
  </example>
  <example>
   <user>That didn't work</user>
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
   <user>try again</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>do that again</user>
   <answer>GPT-4.1-mini</answer>
  </example>
  <example>
   <user>move to A7</user>
   <answer>GPT-4.1-mini</answer>
  </example>
  <example>
   <user>change text color to blue in all the rows that have gender male</user>
   <answer>Claude</answer>
  </example>
  <example>
   <user>Remove column B from the data</user>
   <answer>GPT-4.1-mini</answer>
  </example>
  <example>
   <user>How much does each crop produce per year?</user>
   <answer>GPT-4.1-mini</answer>
  </example>
 <example>
   <user>Sum the values in column F</user>
   <answer>Flash</answer>
  </example>
 <example>
   <user>Calculate the mean of costs</user>
   <answer>Flash</answer>
  </example>
<example>
   <user>Find the mean, filtered by product type</user>
   <answer>GPT-4.1-mini</answer>
  </example>
<example>
   <user>Highlight column C blue</user>
   <answer>Flash</answer>
  </example>
<example>
   <user>Highlight all male entries orange</user>
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

    const parsedResponse = await handleAIRequest(DEFAULT_MODEL_ROUTER_MODEL, args);

    const setAIModelToolCall = parsedResponse?.responseMessage.toolCalls.find(
      (toolCall) => toolCall.name === AITool.SetAIModel
    );
    if (setAIModelToolCall) {
      const argsObject = JSON.parse(setAIModelToolCall.arguments);
      const { ai_model } = aiToolsSpec[AITool.SetAIModel].responseSchema.parse(argsObject);
      return MODELS_ROUTER_CONFIGURATION[ai_model];
    }
  } catch (error) {
    console.error('Error in getModelKey:', error);
  }

  return DEFAULT_BACKUP_MODEL;
};
