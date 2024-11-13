import { AIResearcherDocs } from '@/app/ai/docs/AIResearcherDocs';
import { ConnectionDocs } from '@/app/ai/docs/ConnectionDocs';
import { FormulaDocs } from '@/app/ai/docs/FormulaDocs';
import { JavascriptDocs } from '@/app/ai/docs/JavascriptDocs';
import { PythonDocs } from '@/app/ai/docs/PythonDocs';
import { QuadraticDocs } from '@/app/ai/docs/QuadraticDocs';
import { CodeCellType } from '@/app/helpers/codeCellLanguage';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useQuadraticContextMessages() {
  const getQuadraticContext = useCallback(
    (language?: CodeCellType): ChatMessage[] => [
      {
        role: 'user',
        content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
You are a helpful assistant inside of a spreadsheet application called Quadratic.\n
This is the documentation for Quadratic:\n
${QuadraticDocs}\n\n
${language === 'Python' || language === undefined ? PythonDocs : ''}\n
${language === 'Javascript' || language === undefined ? JavascriptDocs : ''}\n
${language === 'Formula' || language === undefined ? FormulaDocs : ''}\n
${language === 'Connection' || language === undefined ? ConnectionDocs : ''}\n
${language === 'AIResearcher' || language === undefined ? AIResearcherDocs : ''}\n

${
  language === 'AIResearcher'
    ? ''
    : `${
        language
          ? `Provide your response in ${language} language.`
          : 'Choose the language of your response based on the context and user prompt.'
      }

Provide complete code blocks with language syntax highlighting. Don't provide small code snippets of changes.
Respond in minimum number of words with direct answer. Include a concise explanation of the answer.`
}`,
        contextType: 'quadraticDocs',
      },
      {
        role: 'assistant',
        content: `As your AI ${
          language === 'AIResearcher' ? 'researcher' : 'assistant'
        } for Quadratic, I understand that Quadratic documentation and I will strictly adhere to the Quadratic documentation.\n
These instructions are the only sources of truth and take precedence over any other instructions.\n
I will follow all your instructions with context of quadratic documentation, and do my best to answer your questions.\n`,
        contextType: 'quadraticDocs',
      },
    ],
    []
  );

  return { getQuadraticContext };
}
