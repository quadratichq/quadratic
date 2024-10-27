import { sheets } from '@/app/grid/controller/Sheets';
import { GridBounds, JsCellValuePosAIContext, SheetRect } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIModel, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCurrentSheetContextMessages() {
  const getCurrentSheetContextMessages = useCallback(
    ({
      sheetBounds,
      sheetRectContext,
      model,
    }: {
      sheetBounds: GridBounds;
      sheetRectContext: JsCellValuePosAIContext[] | undefined;
      model: AIModel;
    }): ChatMessage[] => {
      return [
        {
          role: 'user',
          content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
I have an open sheet with the following characteristics:
${
  sheetBounds.type === 'nonEmpty'
    ? `- Data range: from (${sheetBounds.min.x}, ${sheetBounds.min.y}) to (${sheetBounds.max.x}, ${sheetBounds.max.y})
- Note: This range may contain empty cells.`
    : '- The sheet is currently empty.'
}\n\n

${
  sheetRectContext
    ? `
Data in the currently open sheet:\n

I am sharing current sheet data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
  - rect_origin: This is a JSON object having x and y properties. x is the column index and y is the row index of the top left cell of the rectangle.\n
  - rect_width: This is the width of the rectangle in number of columns.\n
  - rect_height: This is the height of the rectangle in number of rows.\n
  - starting_rect_values: This is a 2D array of cell values (json object format described below). This is the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
  - value: The value of the cell. This is a string representation of the value in the cell.\n
  - kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
  - pos: This is a JSON object having x and y properties. x is the column index and y is the row index of the cell.\n\n

This is being shared so that you can understand the table format, size and value types inside the data rectangle.\n

Data from cells can be referenced by Formulas, Python, Javascript or SQL code using \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions.\n
To reference data from different tabular data rectangles, use multiple \`cells\` functions.\n
Use this sheet data in the context of following messages. Refer to cells if required in code.\n\n

Current sheet data is:\n
\`\`\`json
${JSON.stringify(sheetRectContext)}
\`\`\`
Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code. Use the cell reference functions, like \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions, to reference cells in code.\n\n
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
          model,
          toolCalls: [],
        },
      ];
    },
    []
  );

  const getCurrentSheetContext = useCallback(
    async ({ model }: { model: AIModel }) => {
      const sheetBounds = sheets.sheet.boundsWithoutFormatting;
      const sheetRect: SheetRect | undefined =
        sheetBounds.type === 'empty'
          ? undefined
          : {
              sheet_id: { id: sheets.current },
              min: sheetBounds.min,
              max: sheetBounds.max,
            };
      const sheetRectContext = sheetRect ? await quadraticCore.getAIContextRectsInSheetRect(sheetRect) : undefined;
      return getCurrentSheetContextMessages({ sheetBounds, sheetRectContext, model });
    },
    [getCurrentSheetContextMessages]
  );

  return { getCurrentSheetContext };
}
