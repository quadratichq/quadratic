import { sheets } from '@/app/grid/controller/Sheets';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { rectToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
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
          content: `
Note: This is an internal message for context. Do not quote it in your response.\n\n
I have an open sheet, with sheet name '${currentSheetName}', all actions are performed on this sheet.\n
You can reference data from this or other sheets in the currently open file.\n

${
  sheetBounds.type === 'nonEmpty'
    ? `- Data range: ${rectToA1(sheetBounds)}
- Note: This range may contain empty cells.`
    : '- The currently open sheet is empty.'
}\n\n

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

    This is being shared so that you can understand the data format, size and value types inside the data rectangle.\n

    There are following data in the currently open sheet:\n
    \`\`\`json
    ${JSON.stringify(currentSheetContext[0].data_rects)}
    \`\`\`
    `
      : ''
  }

  Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code, always reference data from the sheet. Use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells in code.
  - In formula, cell reference are done using A1 notation directly, without quotes. Example: \`=SUM(A1:B2)\`. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. Example: \`=SUM('Sheet 1'!A1:B2)\`.\n
  - In Python and Javascript use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. In Python and Javascript, the complete a1 notation selection string is enclosed in double quotes. Example: \`q.cells("'Sheet 1'!A1:B2")\`.\n
  - Tables can be referenced using \`q.cells("Table_Name")\` to reference the entire table.\n
  - Use \`q.cells("Table_Name[#ALL]")\` to reference the entire table including the header.\n
  - Use \`q.cells("Table_Name[#HEADERS]")\` to reference the header of the table.\n
  - Use \`q.cells("Table_Name[#DATA]")\` to reference the data of the table.\n
  - Sheet name is optional, if not provided, it is assumed to be the currently open sheet.\n
  - Sheet name is case sensitive, and is required to be enclosed in single quotes.\n
  - To reference data from different tabular data rectangles, use multiple \`q.cells\` functions.\n

  Use this visible data in the context of following messages. Refer to cells if required in code.\n\n`
    : `This currently open sheet is empty.\n`
}`,
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
