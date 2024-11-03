import { sheets } from '@/app/grid/controller/Sheets';
import { SheetRect } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useOtherSheetsContextMessages() {
  const getOtherSheetsContext = useCallback(
    async ({ sheetNames }: { sheetNames: string[] }): Promise<ChatMessage[]> => {
      if (sheetNames.length === 0) return [];

      const sheetsRects = sheetNames.reduce<SheetRect[]>((acc, sheetName) => {
        const sheet = sheets.getSheetByName(sheetName);
        if (!sheet) return acc;

        const sheetBounds = sheet.boundsWithoutFormatting;
        if (sheetBounds.type === 'empty') return acc;

        const sheetRect: SheetRect = {
          sheet_id: { id: sheet.id },
          min: sheetBounds.min,
          max: sheetBounds.max,
        };
        return [...acc, sheetRect];
      }, []);
      if (sheetsRects.length === 0) return [];

      const sheetsRectContext = await quadraticCore.getAIContextRectsInSheetRects(sheetsRects);
      if (!sheetsRectContext || sheetsRectContext.length === 0) return [];

      return [
        {
          role: 'user',
          content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
I have following other sheets in the same file having the following data:

Data in the currently open file in other sheets:\n

I am sharing other sheets data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
- sheet_name: This is the name of the sheet.\n
- rect_origin: This is a JSON object having x and y properties. x is the column index and y is the row index of the top left cell of the rectangle.\n
- rect_width: This is the width of the rectangle in number of columns.\n
- rect_height: This is the height of the rectangle in number of rows.\n
- starting_rect_values: This is a 2D array of cell values (json object format described below). This is the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
- value: The value of the cell. This is a string representation of the value in the cell.\n
- kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
- pos: This is a JSON object having x and y properties. x is the column index and y is the row index of the cell.\n\n

This is being shared so that you can understand the table format, size and value types inside the data rectangle.\n

Data from cells can be referenced by Formulas, Python, Javascript or SQL code using \`c(x,y,'sheet_name')\` or \`cells((x1,y1), (x2,y2,'sheet_name'), 'sheet_name')\` functions.\n
Sheet name is optional, if not provided, it is assumed to be the currently open sheet.\n
Sheet name is case sensitive, and is required to be enclosed in single quotes.\n
To reference data from different tabular data rectangles, use multiple \`cells\` functions.\n
Use this sheet data in the context of following messages. Refer to cells if required in code.\n\n

${sheetsRectContext.map((sheetRectContext) => {
  if (sheetRectContext.length === 0) return '';
  return `
Data in sheet '${sheetRectContext[0].sheet_name}':

\`\`\`json
${JSON.stringify(sheetRectContext)}
\`\`\`
`;
})}

Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code. Use the cell reference functions, like \`c(x,y, 'sheet_name')\` or \`cells((x1,y1), (x2,y2), 'sheet_name')\` functions, to reference cells in code.\n\n
`,
          contextType: 'otherSheets',
        },
        {
          role: 'assistant',
          content: `I understand the other sheets data, I will reference it to answer following messages. How can I help you?`,
          contextType: 'otherSheets',
        },
      ];
    },
    []
  );

  return { getOtherSheetsContext };
}
