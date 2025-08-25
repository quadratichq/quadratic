import { sheets } from '@/app/grid/controller/Sheets';
import { translateLanguageForAI } from '@/app/helpers/codeCellLanguage';
import type { JsCodeErrorContext } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

const MAX_ERRORS_PER_SHEET = 10;

const translateError = (sheetName: string, errors: JsCodeErrorContext[], isCurrentSheet: boolean): string => {
  let text = `
## ${sheetName}
`;

  if (isCurrentSheet) {
    text += `
This is the user's current sheet.
`;
  }
  const codeErrors = errors.filter((error) => error.error && !error.is_spill && typeof error.language === 'string');
  const connectionErrors = errors.filter(
    (error) => !error.error && !error.is_spill && typeof error.language !== 'string'
  );
  const spills = errors.filter((error) => error.is_spill);

  if (codeErrors.length > 0) {
    text += `
### Code Errors
`;
    for (const error of codeErrors) {
      text += `
- ${error.name} at ${error.pos} is a ${error.language} cell with the following error: "${error.error}".`;
    }
    text += '\n';
  }

  if (connectionErrors.length > 0) {
    text += `
### Connection Errors
`;
    for (const error of connectionErrors) {
      if (typeof error.language !== 'object') continue;
      text += `
- ${error.name} at ${error.pos} is ${translateLanguageForAI(error.language)} with the following error: "${error.error}".`;
    }
    text += '\n';
  }

  if (spills.length > 0) {
    text += `
### Spills
`;
    for (const spill of spills) {
      text += `
- ${spill.name} at ${spill.pos} is a ${translateLanguageForAI(spill.language)} cell that has spilled its content. It's expected to be in the following range: "${spill.expected_bounds}".`;
    }
    text += '\n';
  }

  return text;
};

export function useCodeErrorMessages() {
  const getCodeErrorContext = useCallback(async (): Promise<ChatMessage[]> => {
    const errors = await quadraticCore.getAICodeErrors(MAX_ERRORS_PER_SHEET);

    let errorText = `
# Code and Connection Errors
`;

    if (!errors) {
      errorText += `
There are no errors or spills in the file.`;
    } else {
      // check current sheet first
      const currentSheetName = sheets.sheet.name;
      if (currentSheetName && errors.has(currentSheetName)) {
        errorText += translateError(currentSheetName, errors.get(currentSheetName) ?? [], true);
      }

      const sheetNames = Array.from(errors.keys()).filter((sheetName) => sheetName !== currentSheetName);

      for (const sheetName of sheetNames) {
        errorText += translateError(sheetName, errors.get(sheetName) ?? [], false);
      }
    }

    return [
      {
        role: 'user',
        content: [createTextContent(errorText)],
        contextType: 'codeErrors',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the code errors in code cells in the sheets, I will reference it to answer messages related to fixing code errors or spill errors.`
          ),
        ],
        contextType: 'codeErrors',
      },
    ];
  }, []);

  return { getCodeErrorContext };
}
