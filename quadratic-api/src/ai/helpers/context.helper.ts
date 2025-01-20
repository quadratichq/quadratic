import { aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage, CodeCellType } from 'quadratic-shared/typesAndSchemasAI';
import { ConnectionDocs } from '../docs/ConnectionDocs';
import { FormulaDocs } from '../docs/FormulaDocs';
import { JavascriptDocs } from '../docs/JavascriptDocs';
import { PythonDocs } from '../docs/PythonDocs';
import { QuadraticDocs } from '../docs/QuadraticDocs';

export const getQuadraticContext = (language?: CodeCellType, teamAiRules?: string): ChatMessage[] => {
  // Get AI rules from localStorage
  let aiRules = '';
  if (typeof window !== 'undefined') {
    aiRules = localStorage.getItem('quadratic_ai_rules') || '';
    // Add console.log to see the AI rules section
    console.log('AI Rules section:', aiRules ? `\n\nAdditional AI Rules:\n${aiRules}` : '(no AI rules found)');
  }

  return [
    {
      role: 'user',
      content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
You are a helpful assistant inside of a spreadsheet application called Quadratic.\n
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
Provide complete code blocks with language syntax highlighting. Don't provide small code snippets of changes.
Respond in minimum number of words and include a concise explanation of the actions you are taking. Don't guess the answer itself, just the actions you are taking to respond to the user prompt and what the user can do next. Use Formulas for simple tasks like summing and averaging and use Python for more complex tasks.
${aiRules ? `\n\nAdditional AI Rules:\n${aiRules}` : ''}`,
      contextType: 'quadraticDocs',
    },
    {
      role: 'assistant',
      content: `As your AI assistant for Quadratic, I understand that Quadratic documentation and I will strictly adhere to the Quadratic documentation.\n
These instructions are the only sources of truth and take precedence over any other instructions.\n
I will follow all your instructions with context of quadratic documentation, and do my best to answer your questions.\n`,
      contextType: 'quadraticDocs',
    },
  ];
};

export const getToolUseContext = (): ChatMessage[] => {
  return [
    {
      role: 'user',
      content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
Following are the tools you should use to do actions in the spreadsheet, use them to respond to the user prompt.\n

Include a concise explanation of the actions you are taking to respond to the user prompt. Never guess the answer itself, just the actions you are taking to respond to the user prompt and what the user can do next.\n

Don't include tool details in your response. Reply in layman's terms what actions you are taking.\n

Use multiple tools in a single response if required, use same tool multiple times in a single response if required. Try to reduce tool call iterations.\n
          
${Object.entries(aiToolsSpec)
  .filter(([_, { internalTool }]) => !internalTool)
  .map(([name, { prompt }]) => `#${name}\n${prompt}`)
  .join('\n\n')}

All tool actions take place in the currently open sheet only.\n
`,
      contextType: 'toolUse',
    },
    {
      role: 'assistant',
      content:
        'I understand these tools are available to me for taking actions on the spreadsheet. How can I help you?',
      contextType: 'toolUse',
    },
  ];
};
