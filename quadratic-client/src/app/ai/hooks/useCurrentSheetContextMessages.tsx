import { sheets } from '@/app/grid/controller/Sheets';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { maxRects } from '@/app/ui/menus/AIAnalyst/const/maxRects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCurrentSheetContextMessages() {
  const getCurrentSheetContext = useCallback(
    async ({ currentSheetName }: { currentSheetName: string }): Promise<ChatMessage[]> => {
      const sheet = sheets.getSheetByName(currentSheetName);
      if (!sheet) return [];
      const sheetBounds = sheet.boundsWithoutFormatting;
      const selection: string | undefined = sheetBounds.type === 'empty' ? undefined : getAllSelection(sheet.id);
      const currentSheetContext = selection
        ? await quadraticCore.getAIContextRectsInSelections([selection], maxRects)
        : undefined;

      return [
        {
          role: 'user',
          content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
I have an open sheet, with sheet name '${currentSheetName}', with the following data:
${
  sheetBounds.type === 'nonEmpty'
    ? `- Data range: from (${sheetBounds.min.x}, ${sheetBounds.min.y}) to (${sheetBounds.max.x}, ${sheetBounds.max.y})
- Note: This range may contain empty cells.`
    : '- The sheet is currently empty.'
}\n\n

${
  currentSheetContext && currentSheetContext.length === 1
    ? `
Data in the currently open sheet:\n

I am sharing current sheet data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
- sheet_name: This is the name of the sheet.\n
- rect_origin: This is the position of the top left cell of the data rectangle in A1 notation. Columns are represented by letters and rows are represented by numbers.\n
- rect_width: This is the width of the rectangle in number of columns.\n
- rect_height: This is the height of the rectangle in number of rows.\n
- starting_rect_values: This is a 2D array of cell values (json object format described below). This 2D array contains the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
- value: The value of the cell. This is a string representation of the value in the cell.\n
- kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
- pos: This is the position of the cell in A1 notation. Columns are represented by letters and rows are represented by numbers.\n\n

This is being shared so that you can understand the table format, size and value types inside the data rectangle.\n

Data from cells can be referenced by Formulas, Python, Javascript or SQL code using the cell reference function \`q\`, i.e. \`q(a1_notation)\`, to reference data cells. Always use sheet name to reference cells in other sheets.\n
To reference data from different tabular data rectangles, use multiple \`q\` functions.\n
Use this sheet data in the context of following messages. Refer to cells if required in code.\n\n

Current sheet data is:\n
\`\`\`json
${JSON.stringify(currentSheetContext[0])}
\`\`\`
Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code. Use the cell reference function \`q\`, i.e. \`q(a1_notation)\`, to reference data cells in code. Always use sheet name to reference cells in other sheets.\n\n
`
    : `This currently open sheet is empty.\n`
}\n
`,
          contextType: 'currentSheet',
        },
        {
          role: 'assistant',
          content: `I understand the current sheet data, I will reference it to answer following messages. How can I help you?`,
          contextType: 'currentSheet',
        },
      ];
    },
    []
  );

  return { getCurrentSheetContext };
}
