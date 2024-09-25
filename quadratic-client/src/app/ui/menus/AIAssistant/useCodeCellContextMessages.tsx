import { CodeCell } from '@/app/gridGL/types/codeCell';
import { Coordinate } from '@/app/gridGL/types/size';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { connectionClient } from '@/shared/api/connectionClient';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCodeCellContextMessages() {
  const getCodeCellContextMessages = useCallback(
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
    : `Add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.\n
Use any functions that are part of the ${language} library.\n
A code cell can return only one type of value as specified in the Quadratic documentation.\n
A code cell cannot display both a chart and return a data frame at the same time.\n
A code cell cannot display multiple charts at the same time.\n
Do not use any markdown syntax besides triple backticks for ${language} code blocks.\n
Do not reply code blocks in plain text, use markdown with triple backticks and language name ${language}.`
}
The code in the cell is:
\`\`\`${language}\n${codeString}\n\`\`\`

${
  consoleHasOutput
    ? `Code was run recently and the console output is: 
\`\`\`json\n${JSON.stringify(consoleOutput)}\n\`\`\``
    : ``
}`,
          internalContext: true,
        },
        {
          role: 'assistant',
          content: `How can I help you?`,
          model: model,
          internalContext: true,
        },
      ];
    },
    []
  );

  const getCodeCellContext = useCallback(
    async ({ codeCell, model }: { codeCell: CodeCell; model: AnthropicModel | OpenAIModel }) => {
      const { sheetId, pos, language } = codeCell;
      const codeCellCore = await quadraticCore.getCodeCell(sheetId, pos.x, pos.y);
      const codeString = codeCellCore?.code_string ?? '';
      const consoleOutput = {
        std_out: codeCellCore?.std_out ?? '',
        std_err: codeCellCore?.std_err ?? '',
      };

      let schemaData;
      const connection = getConnectionInfo(language);
      if (connection) {
        schemaData = await connectionClient.schemas.get(
          connection.kind.toLowerCase() as 'postgres' | 'mysql' | 'mssql',
          connection.id
        );
      }
      const schemaJsonForAi = schemaData ? JSON.stringify(schemaData) : undefined;

      const codeContext = getCodeCellContextMessages(model, pos, language, codeString, consoleOutput, schemaJsonForAi);

      return codeContext;
    },
    [getCodeCellContextMessages]
  );

  return { getCodeCellContext };
}
