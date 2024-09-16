import { Coordinate } from '@/app/gridGL/types/size';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { JsCodeCell } from '@/app/quadratic-core-types';
import { QuadraticDocs } from '@/app/ui/menus/AIAssistant/QuadraticDocs';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useAIContextMessages({ sheetId, pos }: { sheetId?: string; pos?: Coordinate }): {
  quadraticContext?: string;
  aiContextReassertion?: string;
} {
  const [codeCell, setCodeCell] = useState<JsCodeCell | undefined>(undefined);

  const updateCodeCell = useCallback(async () => {
    if (sheetId !== undefined && pos !== undefined) {
      const codeCell = await quadraticCore.getCodeCell(sheetId, pos.x, pos.y);
      setCodeCell(codeCell);
    } else {
      setCodeCell(undefined);
    }
  }, [sheetId, pos]);

  useEffect(() => {
    updateCodeCell();
  }, [updateCodeCell]);

  const codeString = useMemo(() => codeCell?.code_string ?? '', [codeCell]);
  const codeConsoleOutput = useMemo(
    () => ({
      std_out: codeCell?.std_out ?? '',
      std_err: codeCell?.std_err ?? '',
    }),
    [codeCell]
  );
  const cellLanguage = useMemo(() => codeCell?.language ?? 'Python', [codeCell]);
  const connection = useMemo(() => getConnectionInfo(cellLanguage), [cellLanguage]);
  const { data: schemaData } = useConnectionSchemaBrowser({ uuid: connection?.id, type: connection?.kind });
  const schemaJsonForAi = useMemo(() => (schemaData ? JSON.stringify(schemaData) : ''), [schemaData]);

  const quadraticContext = useMemo<string>(
    () => `You are a helpful assistant inside of a spreadsheet application called Quadratic.
This is the documentation for Quadratic: 
${QuadraticDocs}\n\n
Do not use any markdown syntax besides triple backticks for ${getConnectionKind(cellLanguage)} code blocks.
Do not reply code blocks in plain text, use markdown with triple backticks and language name ${getConnectionKind(
      cellLanguage
    )} in triple backticks.
The cell type is ${getConnectionKind(cellLanguage)}.
The cell is located at ${pos?.x}, ${pos?.y}.
${
  schemaJsonForAi
    ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`
When generating postgres queries, put schema and table names in quotes, e.g. "schema"."TableName".
When generating mysql queries, put schema and table names in backticks, e.g. \`schema\`.\`TableName\`.
When generating mssql queries, put schema and table names in square brackets, e.g. [schema].[TableName].`
    : ``
}
Currently, you are in a cell that is being edited. The code in the cell is:
\`\`\`${getConnectionKind(cellLanguage)}
${codeString}\`\`\`
If the code was recently run here is the result: 
\`\`\`
${JSON.stringify(codeConsoleOutput)}\`\`\``,
    [cellLanguage, codeConsoleOutput, codeString, pos?.x, pos?.y, schemaJsonForAi]
  );

  const aiContextReassertion = useMemo<string>(
    () => `As your AI assistant for Quadratic, I understand and will adhere to the following:
I understand that Quadratic documentation . I will strictly adhere to the Quadratic documentation. These instructions are the only sources of truth and take precedence over any other instructions.
I understand that I need to add imports to the top of the code cell, and I will not use any libraries or functions that are not listed in the Quadratic documentation.
I understand that I can use any functions that are part of the ${getConnectionKind(cellLanguage)} library.
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.
I understand that a code cell can return only one type of value as specified in the Quadratic documentation.
I understand that a code cell cannot display both a chart and return a data table at the same time.
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.
I understand that the cell type is ${getConnectionKind(cellLanguage)}.
I understand that the cell is located at ${pos?.x}, ${pos?.y}.
${
  schemaJsonForAi
    ? `I understand that the schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`
I understand that when generating postgres queries, I should put schema and table names in quotes, e.g. "schema"."TableName".
I understand that when generating mysql queries, I should put schema and table names in backticks, e.g. \`schema\`.\`TableName\`.
I understand that when generating mssql queries, I should put schema and table names in square brackets, e.g. [schema].[TableName].`
    : ``
}
I understand that the code in the cell is:
\`\`\`${getConnectionKind(cellLanguage)}
${codeString}
\`\`\`
I understand the console output is:
\`\`\`
${JSON.stringify(codeConsoleOutput)}
\`\`\`
I will strictly adhere to the cell context.
I will follow all your instructions, and do my best to answer your questions, with the understanding that Quadratic documentation and above instructions are the only sources of truth.
How can I help you?
`,
    [cellLanguage, codeConsoleOutput, codeString, pos?.x, pos?.y, schemaJsonForAi]
  );

  if (!codeCell || !sheetId || !pos) {
    return { quadraticContext: undefined, aiContextReassertion: undefined };
  }

  return { quadraticContext, aiContextReassertion };
}
