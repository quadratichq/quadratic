import { toMarkdown } from '@/app/ai/utils/markdownFormatter';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getConnectionKind, getUserManageableConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { connectionClient } from '@/shared/api/connectionClient';
import { GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';

export const codeCellToMarkdown = async (sheetId: string, x: number, y: number): Promise<string> => {
  const codeCellCore = await quadraticCore.getCodeCell(sheetId, x, y);

  if (!codeCellCore) {
    throw new Error('Code cell not found');
  }
  const codeString = codeCellCore?.code_string ?? '';
  const consoleOutput = {
    std_out: codeCellCore?.std_out ?? '',
    std_err: codeCellCore?.std_err ?? '',
  };

  let schemaData: Awaited<ReturnType<typeof connectionClient.schemas.get>> = null;
  const connection = getUserManageableConnectionInfo(codeCellCore.language);
  const teamUuid = pixiAppSettings.editorInteractionState.teamUuid;
  if (connection) {
    try {
      schemaData = await connectionClient.schemas.get(
        connection.kind,
        connection.id,
        teamUuid,
        true,
        GET_SCHEMA_TIMEOUT
      );
    } catch (e) {
      console.error('Error getting schema for code cell', e);
    }
  }
  const schemaMarkdownForAi = schemaData ? toMarkdown(schemaData, 'database_schema') : undefined;

  const a1Pos = xyToA1(x, y);
  const language = getConnectionKind(codeCellCore.language);
  const consoleHasOutput = consoleOutput.std_out !== '' || consoleOutput.std_err !== '';
  return `The code cell type is ${language}. The code cell is located at ${a1Pos}.\n
${
  schemaMarkdownForAi
    ? `The schema for the database is:\n\`\`\`\n${schemaMarkdownForAi}\`\`\`\n${
        language === 'POSTGRES' || language === 'COCKROACHDB' || language === 'SUPABASE' || language === 'NEON'
          ? 'When generating postgres queries, put schema and table names in quotes, e.g. "schema"."TableName".'
          : ''
      }
${
  language === 'MYSQL' || language === 'MARIADB'
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
}
${
  language === 'BIGQUERY'
    ? 'When generating BigQuery queries, put schema and table names in backticks, e.g. `schema`.`TableName`.'
    : ''
}
${language === 'MIXPANEL' || language === 'GOOGLE_ANALYTICS' || language === 'PLAID' ? 'When generating Mixpanel, Google Analytics, or Plaid queries, do not include the schema name in the query.  Only quote column names and tables names if they have reserved words.  Table names are not requires in select statemnts where only one table is being selected.' : ''}
\n`
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
\`\`\`\n${toMarkdown(consoleOutput, 'console_output')}\`\`\`
`
    : ``
}`;
};
