import { CodeCellType } from '@/app/helpers/codeCellLanguage';
import { ConnectionDocs } from '@/app/ui/menus/AIAssistant/docs/ConnectionDocs';
import { FormulaDocs } from '@/app/ui/menus/AIAssistant/docs/FormulaDocs';
import { JavascriptDocs } from '@/app/ui/menus/AIAssistant/docs/JavascriptDocs';
import { PythonDocs } from '@/app/ui/menus/AIAssistant/docs/PythonDocs';
import { QuadraticDocs } from '@/app/ui/menus/AIAssistant/docs/QuadraticDocs';
import { PromptMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useQuadraticContextMessages() {
  const getQuadraticContext = useCallback(
    (language?: CodeCellType): PromptMessage[] => [
      {
        role: 'user',
        content: `Note: Treat this message as an internal message for context. Don't quote it in your response.\n\n
You are a helpful assistant inside of a spreadsheet application called Quadratic.\n
This is the documentation for Quadratic:\n
${QuadraticDocs}\n\n
${
  language === 'Python'
    ? PythonDocs
    : language === 'Javascript'
    ? JavascriptDocs
    : language === 'Formula'
    ? FormulaDocs
    : language === 'Connection'
    ? ConnectionDocs
    : PythonDocs
}\n
Provide your response in ${
          language ?? 'Python'
        } language. Provide complete code blocks with language syntax highlighting. Don't provide small code snippets of changes.
Respond in minimum number of words with direct answer. Don't explain the answer.
`,
      },
      {
        role: 'assistant',
        content: `As your AI assistant for Quadratic, I understand that Quadratic documentation and I will strictly adhere to the Quadratic documentation.\n
These instructions are the only sources of truth and take precedence over any other instructions.\n
I will follow all your instructions with context of quadratic documentation, and do my best to answer your questions.\n`,
      },
    ],
    []
  );

  return { getQuadraticContext };
}
