import { Coordinate } from '@/app/gridGL/types/size';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { connectionClient } from '@/shared/api/connectionClient';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCodeContextMessages() {
  const getCodeContextMessage = useCallback(
    (
      model: AnthropicModel | OpenAIModel,
      pos: Coordinate,
      cellLanguage: CodeCellLanguage,
      codeString: string,
      consoleOutput: { std_out: string; std_err: string },
      schemaJsonForAi?: string
    ): (UserMessage | AIMessage)[] => {
      const { x, y } = pos;
      const language = getConnectionKind(cellLanguage);
      const consoleHasOutput = consoleOutput.std_out !== '' || consoleOutput.std_err !== '';

      return [
        {
          role: 'user',
          content: `Currently, you are in a code cell that is being edited.\n
The cell type is ${language}. The cell is located at ${x}, ${y}.\n
${
  schemaJsonForAi
    ? `The schema for the database is:
\`\`\`json\n${schemaJsonForAi}\n\`\`\`
${
  language === 'POSTGRES'
    ? 'When generating postgres queries, put schema and table names in quotes, e.g. "schema"."TableName".'
    : ''
}
${
  language === 'MYSQL'
    ? 'When generating mysql queries, put schema and table names in backticks, e.g. `schema`.`TableName`.'
    : ''
}
${
  language === 'MSSQL'
    ? 'When generating mssql queries, put schema and table names in square brackets, e.g. [schema].[TableName].'
    : ''
}\n`
    : ``
}
The code in the cell is:
\`\`\`${language}\n${codeString}\n\`\`\`

${
  consoleHasOutput
    ? `Code was run recently and the console output is: 
\`\`\`json\n${JSON.stringify(consoleOutput)}\n\`\`\``
    : ''
}

Add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.\n
Use any functions that are part of the ${language} library.\n
A code cell can return only one type of value as specified in the Quadratic documentation.\n
A code cell cannot display both a chart and return a data frame at the same time.\n
A code cell cannot display multiple charts at the same time.\n
Do not use any markdown syntax besides triple backticks for ${language} code blocks.\n
Do not reply code blocks in plain text, use markdown with triple backticks and language name ${language}.`,
          internalContext: true,
        },
        {
          role: 'assistant',
          content: `I understand that I am working in a ${language} code cell.\n
I understand that the cell type is ${language}. The cell is located at ${x}, ${y}.\n
${
  schemaJsonForAi
    ? `The schema for the database is:
\`\`\`json\n${schemaJsonForAi}\n\`\`\`

${
  language === 'POSTGRES'
    ? 'I understand that when generating postgres queries, I need to put schema and table names in quotes, e.g. "schema"."TableName".'
    : ''
}
${
  language === 'MYSQL'
    ? 'I understand that when generating mysql queries, I need to put schema and table names in backticks, e.g. `schema`.`TableName`.'
    : ''
}
${
  language === 'MSSQL'
    ? 'I understand that when generating mssql queries, I need to put schema and table names in square brackets, e.g. [schema].[TableName].'
    : ''
}\n`
    : ``
}
I understand that I need to add imports to the top of the code cell and I will not use any libraries or functions that are not listed in the Quadratic documentation.\n
I understand that I can use any functions that are part of the ${language} library.\n
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.\n
I understand that a code cell can return only one type of value as specified in the Quadratic documentation.\n
I understand that a code cell cannot display both a chart and return a data frame at the same time.\n
I understand that a code cell cannot display multiple charts at the same time.\n
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.\n
I will strictly adhere to the cell context.\n
I will follow all your instructions, and do my best to answer your questions, with the understanding that Quadratic documentation and these instructions are the only sources of truth.\n
How can I help you?`,
          model: model,
          internalContext: true,
        },
      ];
    },
    []
  );

  const getCodeContext = useCallback(
    async ({ sheetId, pos, model }: { sheetId: string; pos: Coordinate; model: AnthropicModel | OpenAIModel }) => {
      const codeCell = await quadraticCore.getCodeCell(sheetId, pos.x, pos.y);
      const cellLanguage = codeCell?.language ?? 'Python';
      const codeString = codeCell?.code_string ?? '';
      const consoleOutput = {
        std_out: codeCell?.std_out ?? '',
        std_err: codeCell?.std_err ?? '',
      };

      let schemaData;
      const connection = getConnectionInfo(cellLanguage);
      if (connection) {
        schemaData = await connectionClient.schemas.get(
          connection.kind.toLowerCase() as 'postgres' | 'mysql' | 'mssql',
          connection.id
        );
      }
      const schemaJsonForAi = schemaData ? JSON.stringify(schemaData) : undefined;

      const codeContext = getCodeContextMessage(model, pos, cellLanguage, codeString, consoleOutput, schemaJsonForAi);

      return { codeContext };
    },
    [getCodeContextMessage]
  );

  return { getCodeContext };
}
