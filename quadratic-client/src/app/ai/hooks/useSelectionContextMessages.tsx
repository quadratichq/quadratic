import { sheets } from '@/app/grid/controller/Sheets';
import { xyToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { maxRects } from '@/app/ui/menus/AIAnalyst/const/maxRects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage, Context } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSelectionContextMessages() {
  const getSelectionContext = useCallback(
    async ({ selection }: { selection: Context['selection'] }): Promise<ChatMessage[]> => {
      const selectionContext = selection
        ? await quadraticCore.getAISelectionContexts({
            selections: [selection],
            maxRects,
            includeErroredCodeCells: true,
            includeTablesSummary: false,
            includeChartsSummary: false,
          })
        : undefined;

      if (!selectionContext) {
        return [];
      }

      return [
        {
          role: 'user',
          content: `
Note: This is an internal message for context. Do not quote it in your response.\n\n
${
  !!selectionContext && selectionContext.length === 1
    ? `
Quadratic, like most spreadsheets, allows the user to select cells on the sheet.\n
My current cursor selection is: ${sheets.sheet.cursor.a1String()}, use this to position your response on the sheet. Always check if there is sufficient space on the sheet to position your response. Never accidentally overwrite any data on the sheet just to use this cursor position.\n

${
  !!selectionContext[0].data_rects && selectionContext[0].data_rects.length > 0
    ? `
I am sharing selection data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
- sheet_name: This is the name of the sheet.\n
- rect_origin: This is the position of the top left cell of the data rectangle in A1 notation. Columns are represented by letters and rows are represented by numbers.\n
- rect_width: This is the width of the rectangle in number of columns.\n
- rect_height: This is the height of the rectangle in number of rows.\n
- starting_rect_values: This is a 2D array of cell values (json object format described below). This 2D array contains the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
- value: The value of the cell. This is a string representation of the value in the cell.\n
- kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
- pos: This is the position of the cell in A1 notation. Columns are represented by letters and rows are represented by numbers.\n\n

This is being shared so that you can understand the data format, size and value types inside the data rectangle.\n

Current selection data is:\n
\`\`\`json
${JSON.stringify(selectionContext[0].data_rects)}
\`\`\`

Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code, always reference data from the sheet.
- In formula, cell reference are done using A1 notation directly, without quotes. Example: \`=SUM(A1:B2)\`. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. Example: \`=SUM('Sheet 1'!A1:B2)\`.\n
- In Python and Javascript use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. In Python and Javascript, the complete a1 notation selection string is enclosed in double quotes. Example: \`q.cells("'Sheet 1'!A1:B2")\`.\n
- Tables can be referenced using \`q.cells("Table_Name")\` to reference the entire table.\n
- Use \`q.cells("Table_Name[#ALL]")\` to reference the entire table including the header.\n
- Use \`q.cells("Table_Name[#HEADERS]")\` to reference the header of the table.\n
- Use \`q.cells("Table_Name[#DATA]")\` to reference the data of the table.\n
- Sheet name is optional, if not provided, it is assumed to be the currently open sheet.\n
- Sheet name is case sensitive, and is required to be enclosed in single quotes.\n
- To reference data from different tabular data rectangles, use multiple \`q.cells\` functions.\n

Use this selection data in the context of following messages. Refer to cells if required in code.\n\n
`
    : ''
}

${
  !!selectionContext[0].errored_code_cells && selectionContext[0].errored_code_cells.length > 0
    ? `
Note: There are code cells in the cursor selection part of the sheet that have errors. Use this to understand if the code cell has any errors and take action when prompted by user to specifically solve the error.\n\n

Add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.\n
Use any functions that are part of the code cell language library.\n
A code cell can return only one type of value as specified in the Quadratic documentation.\n
A code cell cannot display both a chart and return a data frame at the same time.\n
Do not use conditional returns in code cells.\n
A code cell cannot display multiple charts at the same time.\n
Do not use any markdown syntax besides triple backticks for code cell language code blocks.\n
Do not reply code blocks in plain text, use markdown with triple backticks and language name code cell language.\n

${selectionContext[0].errored_code_cells.map(({ x, y, language, code_string, std_out, std_err }) => {
  const consoleOutput = {
    std_out: std_out ?? '',
    std_err: std_err ?? '',
  };
  return `
The code cell type is ${language}. The code cell is located at ${xyToA1(Number(x), Number(y))}.\n

The code in the code cell is:\n
\`\`\`${language}\n${code_string}\n\`\`\`

Code was run recently and the console output is:\n
\`\`\`json\n${JSON.stringify(consoleOutput)}\n\`\`\`
`;
})}`
    : ''
}`
    : `
My cursor position is at ${sheets.sheet.cursor.toCursorA1()} on the currently open sheet. Use this to position your response on the sheet.
Always check if there is sufficient space on the sheet to position your response. Never accidentally overwrite any data on the sheet just to use this cursor position.`
}`,
          contextType: 'selection',
        },
        {
          role: 'assistant',
          content: `I understand the cursor selection data, I will reference it to answer following messages. How can I help you?`,
          contextType: 'selection',
        },
      ];
    },
    []
  );

  return { getSelectionContext };
}
