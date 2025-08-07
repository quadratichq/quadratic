import { maxRects, maxRows } from '@/app/ai/constants/context';
import { toMarkdown } from '@/app/ai/utils/markdownFormatter';
import { sheets } from '@/app/grid/controller/Sheets';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useOtherSheetsContextMessages() {
  const getOtherSheetsContext = useCallback(
    async ({ sheetNames }: { sheetNames: string[] }): Promise<ChatMessage[]> => {
      if (sheetNames.length === 0) return [];

      const selections = sheetNames.reduce<string[]>((acc, sheetName) => {
        const sheet = sheets.getSheetByName(sheetName);
        if (!sheet) return acc;

        const sheetBounds = sheet.boundsWithoutFormatting;
        if (sheetBounds.type === 'empty') return acc;

        const selection = getAllSelection(sheet.id);

        return [...acc, selection];
      }, []);
      if (selections.length === 0) return [];

      const otherSheetsContext = await quadraticCore.getAISelectionContexts({
        selections,
        maxRects,
        maxRows,
        includeErroredCodeCells: false,
        includeTablesSummary: true,
        includeChartsSummary: false,
      });

      if (!otherSheetsContext || otherSheetsContext.length === 0) return [];

      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Note: This is an internal message for context. Do not quote it in your response.\n\n

I have the following sheets in the currently open file:\n
\`\`\`
${toMarkdown(sheetNames, 'sheet_names')}
\`\`\`

You can reference data from these sheets in the context of following messages. Refer to cells if required in code.\n\n

Tables in the currently open file in other sheets (other than the currently open sheet):\n

I am sharing tables summary as an array of table summary objects, each table summary object has following properties:\n
- sheet_name: This is the name of the sheet.\n
- table_name: This is the name of the table. You can use this name to reference the table in code.\n
- table_type: This denotes whether the table is an editable data table or a read only code table (code output).\n
- bounds: This is the bounds (top left cell and bottom right cell, both inclusive) of the data table in A1 notation, this includes the table name and column headers if they are visible.\n

${otherSheetsContext.map((otherSheetContext) => {
  if (!otherSheetContext.tables_summary || otherSheetContext.tables_summary.length === 0) return '';
  return `
Tables in sheet '${otherSheetContext.sheet_name}':

\`\`\`
${toMarkdown(otherSheetContext.tables_summary, 'tables_summary')}
\`\`\`
`;
})}

\n\n

Data in the currently open file in other sheets (other than the currently open sheet):\n

I am sharing other sheets data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
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

${otherSheetsContext.map((otherSheetContext) => {
  if (otherSheetContext.data_rects.length === 0) return '';
  return `
Data in sheet '${otherSheetContext.sheet_name}':

\`\`\`
${toMarkdown(otherSheetContext.data_rects, 'data_rects')}
\`\`\`
`;
})}

Note: All this data is only for you to reference data on the sheet. This data cannot be used directly in code; always use references to access data from the sheet. Use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells in code.
- In formulas, cell references are done using A1 notation directly, without quotes. Example: \`=SUM(A1:B2)\`. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. Example: \`=SUM('Sheet 1'!A1:B2)\`.\n
- In Python and Javascript use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. In Python and Javascript, the complete a1 notation selection string is enclosed in double quotes. Example: \`q.cells("'Sheet 1'!A1:B2")\`.\n
- Use table names (Table_Name) when working with entire tables. Use A1 notation only for non-table data or partial table selections.\n
- In Formulas and JavaScript use \`q.cells("Table_Name[#ALL]")\` to reference the entire table including the header. This does not work in Python.\n
- In all languages use \`q.cells("Table_Name[#HEADERS]")\` to reference the headers of the table.\n
- In Formulas and JavaScript use \`q.cells("Table_Name[#DATA]")\` to reference the data of the table. This does not work in Python.\n
- Sheet name should not be used when referencing data or tables from same sheet as code or formula cell. If not provided, it is assumed to be a reference to values in the same sheet as the code cell.\n
- Sheet name is case sensitive, and is required to be enclosed in single quotes.\n
- To reference data from different tabular data rectangles, use multiple \`q.cells\` functions.\n

Use this visible data in the context of following messages. Refer to cells if required in code.\n\n`,
            },
          ],
          contextType: 'otherSheets',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `I understand the other sheets data, I will reference it to answer following messages. How can I help you?`,
            },
          ],
          contextType: 'otherSheets',
        },
      ];
    },
    []
  );

  return { getOtherSheetsContext };
}
