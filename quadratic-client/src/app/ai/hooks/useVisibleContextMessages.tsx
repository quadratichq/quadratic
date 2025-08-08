import { maxRects, maxRows } from '@/app/ai/constants/context';
import { toMarkdown } from '@/app/ai/utils/markdownFormatter';
import { sheets } from '@/app/grid/controller/Sheets';
import { getRectSelection } from '@/app/grid/sheet/selection';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useVisibleContextMessages() {
  const getVisibleContext = useCallback(async (): Promise<ChatMessage[]> => {
    const visibleRect = sheets.getVisibleRect();
    const visibleRectSelection = getRectSelection(sheets.current, visibleRect);
    const jsSelection = sheets.A1SelectionStringToSelection(visibleRectSelection);
    const visibleA1String = jsSelection.toA1String(sheets.current, sheets.jsA1Context);
    jsSelection.free();

    const sheetBounds = sheets.sheet.boundsWithoutFormatting;
    const isVisibleEmpty = sheetBounds.type === 'empty' || !intersects.rectRect(sheetBounds, visibleRect);
    const visibleContext = isVisibleEmpty
      ? undefined
      : await quadraticCore.getAISelectionContexts({
          selections: [visibleRectSelection],
          maxRects,
          maxRows,
          includeErroredCodeCells: true,
          includeTablesSummary: true,
          includeChartsSummary: true,
        });

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
Note: This is an internal message for context. Do not quote it in your response.\n\n
I have an open sheet with the following part of the sheet visible: ${visibleA1String}\n\n
The cursor is located at ${sheets.sheet.cursor.a1String()}\n\n
The user's selection is ${sheets.getA1String(sheets.current)}\n\n
${
  !!visibleContext && visibleContext.length === 1
    ? `
${
  !!visibleContext[0].tables_summary && visibleContext[0].tables_summary.length > 0
    ? `
Visible tables in the viewport:\n
I am sharing visible tables summary in the viewport as an array of table summary objects, each table summary object has following properties:\n
- sheet_name: This is the name of the sheet.\n
- table_name: This is the name of the table. You can use this name to reference the table in code.\n
- table_type: This denotes whether the table is an editable data table or a read only code table (code output).\n
- bounds: This is the bounds (top left cell and bottom right cell, both inclusive) of the data table in A1 notation, this includes the table name and column headers if they are visible.\n

There are following visible tables in the viewport:\n
\`\`\`markdown
${toMarkdown(visibleContext[0].tables_summary, 'tables_summary')}
\`\`\`
`
    : ''
}

${
  !!visibleContext[0].charts_summary && visibleContext[0].charts_summary.length > 0
    ? `
Visible charts in the viewport:\n
I am sharing visible charts summary in the viewport as an array of chart summary objects, each chart summary object has following properties:\n
- sheet_name: This is the name of the sheet.\n
- chart_name: This is the name of the chart.\n
- bounds: This is the bounds (top left cell and bottom right cell, both inclusive) of the chart in A1 notation, this includes the chart name.\n

Take into account chart bounds when adding values, code or charts to the sheet. Always avoid overplay with chart bounds.\n

There are following visible charts in the viewport:\n
\`\`\`markdown
${toMarkdown(visibleContext[0].charts_summary, 'charts_summary')}
\`\`\`
`
    : ''
}

${
  !!visibleContext[0].data_rects && visibleContext[0].data_rects.length > 0
    ? `
Visible data in the viewport:\n
I am sharing visible data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
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

There are following visible data in the viewport:\n
\`\`\`markdown
${toMarkdown(visibleContext[0].data_rects, 'data_rects')}
\`\`\`
`
    : ''
}

Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code, always reference data from the sheet. Use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells in code.
- In formulas, cell references are done using A1 notation directly, without quotes. Example: \`=SUM(A1:B2)\`. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. Example: \`=SUM('Sheet 1'!A1:B2)\`.\n
- In Python and Javascript use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. In Python and Javascript, the complete a1 notation selection string is enclosed in double quotes. Example: \`q.cells("'Sheet 1'!A1:B2")\`.\n
- Use table names (Table_Name) when working with entire tables. Use A1 notation only for non-table data or partial table selections.\n
- In Formulas and JavaScript use \`q.cells("Table_Name[#ALL]")\` to reference the entire table including the header. This does not work in Python.\n
- In all languages use \`q.cells("Table_Name[#HEADERS]")\` to reference the headers of the table.\n
- In Formulas and JavaScript use \`q.cells("Table_Name[#DATA]")\` to reference the data of the table. This does not work in Python.\n
- Sheet name is optional, if not provided, it is assumed to be the currently open sheet.\n
- Sheet name is case sensitive, and is required to be enclosed in single quotes.\n
- To reference data from different tabular data rectangles, use multiple \`q.cells\` functions.\n

Use this visible data in the context of following messages. Refer to cells if required in code.\n\n

${
  !!visibleContext[0].errored_code_cells && visibleContext[0].errored_code_cells.length > 0
    ? `
Note: There are code cells in the visible part of the sheet that have errors. Use this to understand if the code cell has any errors and take action when prompted by user to specifically solve the error.\n\n

Add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.\n
Use any functions that are part of the code cell language library.\n
A code cell can return only one type of value as specified in the Quadratic documentation.\n
A code cell cannot display both a chart and return a data frame at the same time.\n
Do not use conditional returns in code cells.\n
A code cell cannot display multiple charts at the same time.\n
Do not use any markdown syntax besides triple backticks for code cell language code blocks.\n
Do not reply code blocks in plain text, use markdown with triple backticks and language name code cell language.\n

${visibleContext[0].errored_code_cells.map(({ x, y, language, code_string, std_out, std_err }) => {
  const consoleOutput = {
    std_out: std_out ?? '',
    std_err: std_err ?? '',
  };
  return `
The code cell type is ${language}. The code cell is located at ${xyToA1(Number(x), Number(y))}.\n

The code in the code cell is:\n
\`\`\`${language}\n${code_string}\n\`\`\`

Code was run recently and the console output is:\n
\`\`\`markdown
${toMarkdown(consoleOutput, 'console_output')}
\`\`\`
`;
})}`
    : ''
}`
    : 'The visible part of the sheet is empty.'
}`,
          },
        ],
        contextType: 'visibleData',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `I understand the visible data, I will reference it to answer following messages. How can I help you?`,
          },
        ],
        contextType: 'visibleData',
      },
    ];
  }, []);

  return { getVisibleContext };
}
