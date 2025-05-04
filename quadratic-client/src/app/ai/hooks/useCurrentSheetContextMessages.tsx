import { sheets } from '@/app/grid/controller/Sheets';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { rectToA1 } from '@/app/quadratic-core/quadratic_core';
import { maxRects } from '@/app/ui/menus/AIAnalyst/const/maxRects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

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

CRITICAL INSTRUCTION: You MUST use get_cells BEFORE performing ANY operation on the sheet's data. This is a strict requirement.\n\n
NEVER use set_cell_values or any other data modification tool without first using get_cells to verify the current state of the data.\n\n
You MUST use get_cells in these situations:\n
1. BEFORE any data modification or analysis\n
2. BEFORE checking if cells are empty or contain specific values\n
3. BEFORE making any assumptions about the data\n\n

The sample data shown below is ONLY for understanding the structure of the sheet. It is NOT for making decisions or performing operations.\n
ALWAYS use get_cells to get the current, complete data before proceeding with any task.\n\n

${
  !!currentSheetContext && currentSheetContext.length === 1
    ? `
Data in the currently open sheet:\n

${
  !!currentSheetContext[0].tables_summary && currentSheetContext[0].tables_summary.length > 0
    ? `
I am sharing tables summary in the currently open sheet as an array of table summary objects, each table summary object has following properties:\n
- sheet_name: This is the name of the sheet.\n
- table_name: This is the name of the table. You can use this name to reference the table in code.\n
- table_type: This denotes whether the table is an editable data table or a read only code table (code output).\n
- bounds: This is the bounds (top left cell and bottom right cell, both inclusive) of the data table in A1 notation, this includes the table name and column headers if they are visible.\n

There are following tables in the currently open sheet:\n
\`\`\`json
${JSON.stringify(currentSheetContext[0].tables_summary)}
\`\`\`
`
    : ''
}

${
  !!currentSheetContext[0].charts_summary && currentSheetContext[0].charts_summary.length > 0
    ? `
I am sharing charts summary in the currently open sheet as an array of chart summary objects, each chart summary object has following properties:\n
- sheet_name: This is the name of the sheet.\n
- chart_name: This is the name of the chart.\n
- bounds: This is the bounds (top left cell and bottom right cell, both inclusive) of the chart in A1 notation, this includes the chart name.\n

Take into account chart bounds when adding values, code or charts to the sheet. Always avoid overplay with chart bounds.\n

There are following charts in the currently open sheet:\n
\`\`\`json
${JSON.stringify(currentSheetContext[0].charts_summary)}
\`\`\`
`
    : ''
}

${
  !!currentSheetContext[0].data_rects && currentSheetContext[0].data_rects.length > 0
    ? `
I am sharing data in the currently open sheet as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
- sheet_name: This is the name of the sheet.\n
- rect_origin: This is the position of the top left cell of the data rectangle in A1 notation. Columns are represented by letters and rows are represented by numbers.\n
- rect_width: This is the width of the rectangle in number of columns.\n
- rect_height: This is the height of the rectangle in number of rows.\n
- starting_rect_values: This is a 2D array of cell values (json object format described below). This 2D array contains the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
- value: The value of the cell. This is a string representation of the value in the cell.\n
- kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
- pos: This is the position of the cell in A1 notation. Columns are represented by letters and rows are represented by numbers.\n\n

WARNING: This is ONLY sample data. You MUST use get_cells to get the current data before performing any operations.\n\n

There are following data in the currently open sheet:\n
\`\`\`json
${JSON.stringify(currentSheetContext[0].data_rects)}
\`\`\`
`
    : ''
}

To work with the sheet's data, use the get_cells function in the following ways:\n
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
