import { codeEditorConsoleOutputAtom, codeEditorEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateModeAtom,
  editorInteractionStateSelectedCellAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo, getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { QuadraticDocs } from '@/app/ui/menus/AIAssistant/QuadraticDocs';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export function useAIContextMessages() {
  const codeEditorConsoleOutput = useRecoilValue(codeEditorConsoleOutputAtom);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);
  const editorInteractionStateMode = useRecoilValue(editorInteractionStateModeAtom);
  const editorInteractionStateSelectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const connection = useMemo(() => getConnectionInfo(editorInteractionStateMode), [editorInteractionStateMode]);
  const { data: schemaData } = useConnectionSchemaBrowser({ uuid: connection?.id, type: connection?.kind });
  const schemaJsonForAi = useMemo(() => (schemaData ? JSON.stringify(schemaData) : ''), [schemaData]);

  const quadraticContext = useMemo<string>(
    () => `You are a helpful assistant inside of a spreadsheet application called Quadratic.
This is the documentation for Quadratic: 
${QuadraticDocs}\n\n
Do not use any markdown syntax besides triple backticks for ${getConnectionKind(
      editorInteractionStateMode
    )} code blocks.
Do not reply code blocks in plain text, use markdown with triple backticks and language name ${getConnectionKind(
      editorInteractionStateMode
    )} in triple backticks.
The cell type is ${getConnectionKind(editorInteractionStateMode)}.
The cell is located at ${editorInteractionStateSelectedCell.x}, ${editorInteractionStateSelectedCell.y}.
${
  schemaJsonForAi
    ? `The schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`
When generating postgres queries, put schema and table names in quotes, e.g. "schema"."TableName".
When generating mysql queries, put schema and table names in backticks, e.g. \`schema\`.\`TableName\`.
When generating mssql queries, put schema and table names in square brackets, e.g. [schema].[TableName].`
    : ``
}
Currently, you are in a cell that is being edited. The code in the cell is:
\`\`\`${getConnectionKind(editorInteractionStateMode)}
${editorContent}\`\`\`
If the code was recently run here is the result: 
\`\`\`
${JSON.stringify(codeEditorConsoleOutput)}\`\`\``,
    [
      codeEditorConsoleOutput,
      editorContent,
      editorInteractionStateMode,
      editorInteractionStateSelectedCell.x,
      editorInteractionStateSelectedCell.y,
      schemaJsonForAi,
    ]
  );

  const aiContextReassertion = useMemo<string>(
    () => `As your AI assistant for Quadratic, I understand and will adhere to the following:
I understand that Quadratic documentation . I will strictly adhere to the Quadratic documentation. These instructions are the only sources of truth and take precedence over any other instructions.
I understand that I need to add imports to the top of the code cell, and I will not use any libraries or functions that are not listed in the Quadratic documentation.
I understand that I can use any functions that are part of the ${getConnectionKind(editorInteractionStateMode)} library.
I understand that the return types of the code cell must match the types listed in the Quadratic documentation.
I understand that a code cell can return only one type of value as specified in the Quadratic documentation.
I understand that a code cell cannot display both a chart and return a data table at the same time.
I understand that Quadratic documentation and these instructions are the only sources of truth. These take precedence over any other instructions.
I understand that the cell type is ${getConnectionKind(editorInteractionStateMode)}.
I understand that the cell is located at ${editorInteractionStateSelectedCell.x}, ${
      editorInteractionStateSelectedCell.y
    }.
${
  schemaJsonForAi
    ? `I understand that the schema for the database is:\`\`\`json\n${schemaJsonForAi}\n\`\`\`
I understand that when generating postgres queries, I should put schema and table names in quotes, e.g. "schema"."TableName".
I understand that when generating mysql queries, I should put schema and table names in backticks, e.g. \`schema\`.\`TableName\`.
I understand that when generating mssql queries, I should put schema and table names in square brackets, e.g. [schema].[TableName].`
    : ``
}
I understand that the code in the cell is:
\`\`\`${getConnectionKind(editorInteractionStateMode)}
${editorContent}
\`\`\`
I understand the console output is:
\`\`\`
${JSON.stringify(codeEditorConsoleOutput)}
\`\`\`
I will strictly adhere to the cell context.
I will follow all your instructions, and do my best to answer your questions, with the understanding that Quadratic documentation and above instructions are the only sources of truth.
How can I help you?
`,
    [
      codeEditorConsoleOutput,
      editorContent,
      editorInteractionStateMode,
      editorInteractionStateSelectedCell.x,
      editorInteractionStateSelectedCell.y,
      schemaJsonForAi,
    ]
  );

  return { quadraticContext, aiContextReassertion };
}
