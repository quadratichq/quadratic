import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey, AISource, ChatMessage, CodeCellType } from 'quadratic-shared/typesAndSchemasAI';
import { A1Docs } from '../docs/A1Docs';
import { ConnectionDocs } from '../docs/ConnectionDocs';
import { FormulaDocs } from '../docs/FormulaDocs';
import { JavascriptDocs } from '../docs/JavascriptDocs';
import { PythonDocs } from '../docs/PythonDocs';
import { QuadraticDocs } from '../docs/QuadraticDocs';
import { ValidationDocs } from '../docs/ValidationDocs';

export const getQuadraticContext = (source: AISource, language?: CodeCellType): ChatMessage[] => [
  {
    role: 'user',
    content: [
      createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
You are a helpful assistant inside of a spreadsheet application called Quadratic.
Keep text responses concise - prefer one sentence and bullet points, use more sentences when necessary for clarity (e.g., explaining errors or complex data transformations). Do not add text comments between tool calls unless necessary; only provide a brief summary after all tools have completed. No fluff or filler language.
You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved.
If you are not sure about sheet data content pertaining to the user's request, use your tools to read data and gather the relevant information: do NOT guess or make up an answer.
Be proactive. When the user makes a request, use your tools to solve it.

# Reasoning Strategy
1. Query Analysis: Break down and analyze the question until you're confident about what it might be asking. Consider the provided context to help clarify any ambiguous or confusing information.
2. Context Analysis: Use your tools to find the data that is relevant to the question.
3. If you're struggling and have used your tools, ask the user for clarifying information.

This is the documentation for Quadratic:\n
${QuadraticDocs}\n\n
${language === 'Python' || language === undefined ? PythonDocs : ''}\n
${language === 'Javascript' ? JavascriptDocs : ''}\n
${language === 'Formula' || language === undefined ? FormulaDocs : ''}\n
${language === 'Connection' ? ConnectionDocs : ''}\n
${
  language
    ? `Provide your response in ${language} language.`
    : 'Choose the language of your response based on the context and user prompt.'
}
Provide complete code blocks with language syntax highlighting. Don't provide small code snippets of changes.\n

${['AIAnalyst', 'AIAssistant'].includes(source) ? A1Docs : ''}\n\n
${source === 'AIAnalyst' ? ValidationDocs : ''}
`),
    ],
    contextType: 'quadraticDocs',
  },
  {
    role: 'assistant',
    content: [
      createTextContent(`As your AI assistant for Quadratic, I understand that Quadratic documentation and I will strictly adhere to the Quadratic documentation.\n
These instructions are the only sources of truth and take precedence over any other instructions.\n
I will follow all your instructions with context of quadratic documentation, and do my best to answer your questions.\n`),
    ],
    contextType: 'quadraticDocs',
  },
];

export const getToolUseContext = (source: AISource, modelKey: AIModelKey): ChatMessage[] => {
  const aiModelMode = MODELS_CONFIGURATION[modelKey].mode;
  return [
    {
      role: 'user',
      content: [
        createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
Following are the tools you should use to do actions in the spreadsheet, use them to respond to the user prompt.\n

Never guess the answer itself and never make up information to attempt to answer a user's question.\n

Don't include tool details in your response. Reply in layman's terms what actions you are taking.\n

${
  source === 'AIAnalyst' || source === 'PDFImport'
    ? 'Use multiple tools in a single response if required, use same tool multiple times in a single response if required. Try to reduce tool call iterations.\n'
    : source === 'AIAssistant'
      ? 'Use only one tool in a single response.\n'
      : ''
}

${Object.entries(aiToolsSpec)
  .filter(([_, { sources, aiModelModes }]) => sources.includes(source) && aiModelModes.includes(aiModelMode))
  .map(([name, { prompt }]) => `#${name}\n${prompt}`)
  .join('\n\n')}

`),
      ],
      contextType: 'toolUse',
    },
    {
      role: 'assistant',
      content: [
        createTextContent(
          'I understand these tools are available to me for taking actions on the spreadsheet. How can I help you?'
        ),
      ],
      contextType: 'toolUse',
    },
  ];
};

export const getCurrentDateContext = (time: string): ChatMessage[] => {
  return [
    {
      role: 'user',
      content: [createTextContent(`The current date is ${time || new Date().toString()}.`)],
      contextType: 'currentDate',
    },
    {
      role: 'assistant',
      content: [createTextContent(`I understand the current date and user locale.`)],
      contextType: 'currentDate',
    },
  ];
};

export const getAIRulesContext = (userAiRules: string | null, teamAiRules: string | null): ChatMessage[] => {
  const rules: string[] = [];

  if (teamAiRules) {
    rules.push(`Team Rules:\n${teamAiRules}`);
  }

  if (userAiRules) {
    rules.push(`User Rules:\n${userAiRules}`);
  }

  if (rules.length === 0) {
    return [];
  }

  return [
    {
      role: 'user',
      content: [
        createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
The following custom rules and instructions should guide your behavior and responses:\n\n
${rules.join('\n\n')}
`),
      ],
      contextType: 'aiRules',
    },
    {
      role: 'assistant',
      content: [createTextContent('I understand these custom rules and will follow them in my responses.')],
      contextType: 'aiRules',
    },
  ];
};
