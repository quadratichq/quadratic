import { sheets } from '@/app/grid/controller/Sheets';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { rectToA1 } from '@/app/quadratic-core/quadratic_core';
import { maxRects } from '@/app/ui/menus/AIAnalyst/const/maxRects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { toXml } from '../utils/xmlFormatter';

export function useCurrentSheetContextMessages() {
  const getCurrentSheetContext = useCallback(
    async ({ currentSheetName }: { currentSheetName: string }): Promise<ChatMessage[]> => {
      const sheet = sheets.getSheetByName(currentSheetName);
      if (!sheet) return [];

      const sheetBounds = sheet.boundsWithoutFormatting;
      const formatBounds = sheet.formatBounds;
      const selection: string | undefined = sheetBounds.type === 'empty' ? undefined : getAllSelection(sheet.id);
      const currentSheetContext = !!selection
        ? await quadraticCore.getAISelectionContexts({
            selections: [selection],
            maxRects,
            includeErroredCodeCells: false,
            includeTablesSummary: true,
            includeChartsSummary: true,
          })
        : undefined;

      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Note: This is an internal message for context. Do not quote it in your response.\n\n
I have an open sheet, with sheet name '${currentSheetName}', all actions are performed on this sheet, unless the user specifies otherwise.\n
You can reference data from this or other sheets in the currently open file.\n

The current sheet has the following ranges:\n
${
  sheetBounds.type === 'nonEmpty'
    ? `- Data range: ${rectToA1(sheetBounds)}\n
- Note: This range may contain empty cells.\n`
    : '- The currently open sheet is empty.'
}\n
${
  formatBounds.type === 'nonEmpty'
    ? `- Formatting range (like bold, currency, etc.): ${rectToA1(formatBounds)}\n
- Note: This range may contain non-formatted cells.\n`
    : '- The currently open sheet does not have any formatting.'
}

You may use the get_cell_data function to retrieve information about the sheet that is not contained within the context.\n
Always ensure you have sufficient data before taking action on the sheet. Use get_cell_data to retrieve additional data as needed.\n
Note, there is no data outside the bounds provided above.\n

${
  !!currentSheetContext && currentSheetContext.length === 1
    ? `
Data in the currently open sheet:\n




${
  !!currentSheetContext[0].data_rects && currentSheetContext[0].data_rects.length > 0
    ? `
I am sharing data in the currently open sheet '${currentSheetName}' as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
- rect_origin: This is the position of the top left cell of the data rectangle in A1 notation. Columns are represented by letters and rows are represented by numbers.\n
- rect_width: This is the width of the rectangle in number of columns.\n
- rect_height: This is the height of the rectangle in number of rows.\n
- starting_rect_values: This is a 2D array of cell values (json object format described below). This 2D array contains the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
- value: The value of the cell. This is a string representation of the value in the cell.\n
- kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
- pos: This is the position of the cell in A1 notation. Columns are represented by letters and rows are represented by numbers.\n\n

WARNING: This is ONLY a subset of the data. Use the get_cell_data function to get additional data as defined by the bounds.\n\n

There are following data in the currently open sheet:\n
\`\`\`
${toXml(
  currentSheetContext[0].data_rects.map(({ sheet_name, ...dataRect }) => dataRect),
  'data_rects'
)}
\`\`\`
`
    : ''
}

Otherwise, if confident about what you want to reference, use the following reference methods:\n
1. In formulas, use A1 notation directly: \`=SUM(A1:B2)\`\n
2. In Python and JavaScript, use \`q.cells("A1:B2")\`\n
3. For different sheets, include the sheet name: \`=SUM('Sheet 1'!A1:B2)\` or \`q.cells("'Sheet 1'!A1:B2")\`\n
4. For tables:\n
   - \`q.cells("Table_Name")\` for the entire table\n
   - \`q.cells("Table_Name[#ALL]")\` for table with headers (Formulas/JavaScript only)\n
   - \`q.cells("Table_Name[#HEADERS]")\` for table headers\n
   - \`q.cells("Table_Name[#DATA]")\` for table data (Formulas/JavaScript only)\n\n`
    : `This currently open sheet is empty.\n`
}`,
            },
          ],
          contextType: 'currentSheet',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `I understand the current sheet data, I will reference it to answer following messages. How can I help you?`,
            },
          ],
          contextType: 'currentSheet',
        },
      ];
    },
    []
  );

  return { getCurrentSheetContext };
}
