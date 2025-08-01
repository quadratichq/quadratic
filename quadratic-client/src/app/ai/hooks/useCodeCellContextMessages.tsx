import { toXml } from '@/app/ai/utils/xmlFormatter';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import type { CodeCell } from '@/app/shared/types/codeCell';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { connectionClient } from '@/shared/api/connectionClient';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export function useCodeCellContextMessages() {
  const getCodeCellContext = useRecoilCallback(
    ({ snapshot }) =>
      async ({ codeCell }: { codeCell: CodeCell }): Promise<ChatMessage[]> => {
        const { sheetId, pos, language: cellLanguage } = codeCell;
        const codeCellCore = await quadraticCore.getCodeCell(sheetId, pos.x, pos.y);
        const codeString = codeCellCore?.code_string ?? '';
        const consoleOutput = {
          std_out: codeCellCore?.std_out ?? '',
          std_err: codeCellCore?.std_err ?? '',
        };

        let schemaData: Awaited<ReturnType<typeof connectionClient.schemas.get>> = null;
        const connection = getConnectionInfo(cellLanguage);
        const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
        if (connection) {
          schemaData = await connectionClient.schemas.get(
            connection.kind.toLowerCase() as 'postgres' | 'mysql' | 'mssql',
            connection.id,
            teamUuid
          );
        }
        const schemaJsonForAi = schemaData ? toXml(schemaData, 'database_schema') : undefined;
        const a1Pos = xyToA1(pos.x, pos.y);
        const language = getConnectionKind(cellLanguage);
        const consoleHasOutput = consoleOutput.std_out !== '' || consoleOutput.std_err !== '';

        return [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Note: This is an internal message for context. Do not quote it in your response.\n\n
Currently, you are in a code cell that is being edited.\n
The code cell type is ${language}. The code cell is located at ${a1Pos}.\n
${
  schemaJsonForAi
    ? `The schema for the database is:\n\`\`\`\n${schemaJsonForAi}\`\`\`\n${
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
}
${
  language === 'SNOWFLAKE'
    ? 'When generating Snowflake queries, put schema and table names in double quotes, e.g. "SCHEMA"."TABLE_NAME".'
    : ''
}\n`
    : `Add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.\n
Use any functions that are part of the ${language} library.\n
A code cell can return only one type of value as specified in the Quadratic documentation.\n
A code cell cannot display both a chart and return a data frame at the same time.\n
A code cell cannot display multiple charts at the same time.\n
Do not use conditional returns in code cells.\n
Do not use any markdown syntax besides triple backticks for ${language} code blocks.\n
Do not reply code blocks in plain text, use markdown with triple backticks and language name ${language}.`
}
The code in the code cell is:\n
\`\`\`${language}\n${codeString}\n\`\`\`

${
  consoleHasOutput
    ? `Code was run recently and the console output is:\n
\`\`\`\n${toXml(consoleOutput, 'console_output')}\`\`\`
`
    : ``
}`,
              },
            ],
            contextType: 'codeCell',
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: `How can I help you?`,
              },
            ],
            contextType: 'codeCell',
          },
        ];
      },
    []
  );

  return { getCodeCellContext };
}
