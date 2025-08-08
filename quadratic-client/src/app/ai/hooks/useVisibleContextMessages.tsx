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
    const sheetName = sheets.sheet.name;
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

    let text = `
# What the user can see

## User's selection
The user in on sheet "${sheetName}" and can see cells in ${visibleA1String}. The user's cursor is located at ${sheets.sheet.cursor.a1String()} and their selection is ${sheets.getA1String(sheets.current)}.`;
    if (!!visibleContext && visibleContext.length === 1) {
      const context = visibleContext[0];
      if (context.tables_summary && context.tables_summary.length > 0) {
        text += `

## Tables and Code Summary
The user can see the following tables in the viewport.
${context.tables_summary.map((table) => {
  return `
### Table name: ${table.table_name}

The table is ${
    table.table_type === 'python'
      ? 'a Python table'
      : table.table_type === 'javascript'
        ? 'a Javascript table'
        : table.table_type === 'formula'
          ? 'a Formula table'
          : table.table_type === 'connection'
            ? `a connection of type ${table.connection_name}`
            : 'a Data table'
  } with bounds of ${table.bounds}.
`;
})}
`;
      }
      if (context.charts_summary && context.charts_summary.length > 0) {
        text += `

## Chart Summary
The user can see the following charts in the viewport:

${toMarkdown(context.charts_summary, 'charts_summary')}
`;
      }
      if (context.data_rects && context.data_rects.length > 0) {
        text += `

## Data Summary
The user can see the following data in the viewport:

${toMarkdown(context.data_rects, 'data_rects')}
`;
      }

      text += `
## How to use this data
  Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code, always reference data from the sheet. Use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells in code.
- In formulas, cell references are done using A1 notation directly, without quotes. Example: \`=SUM(A1:B2)\`. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. Example: \`=SUM('Sheet 1'!A1:B2)\`.
- In Python and Javascript use the cell reference function \`q.cells\`, i.e. \`q.cells(a1_notation_selection_string)\`, to reference data cells. Always use sheet name in a1 notation to reference cells from different sheets. Sheet name is always enclosed in single quotes. In Python and Javascript, the complete a1 notation selection string is enclosed in double quotes. Example: \`q.cells("'Sheet 1'!A1:B2")\`.
- Use table names (Table_Name) when working with entire tables. Use A1 notation only for non-table data or partial table selections.
- In Formulas and JavaScript use \`q.cells("Table_Name[#ALL]")\` to reference the entire table including the header. This does not work in Python.
- In all languages use \`q.cells("Table_Name[#HEADERS]")\` to reference the headers of the table.
- In Formulas and JavaScript use \`q.cells("Table_Name[#DATA]")\` to reference the data of the table. This does not work in Python.
- Sheet name is optional, if not provided, it is assumed to be the currently open sheet.
- Sheet name is case sensitive, and is required to be enclosed in single quotes.
- To reference data from different tabular data rectangles, use multiple \`q.cells\` functions.
`;

      if (context.errored_code_cells && context.errored_code_cells.length > 0) {
        text += `
## Errored Code Cells
There are code cells in the visible part of the sheet that have errors. Use this to understand if the code cell has any errors and take action when prompted by user to specifically solve the error.

For Python cells, add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.
Use any functions that are part of the code cell language library.
A code cell can return only one type of value as specified in the Quadratic documentation.
A code cell cannot display both a chart and return a data frame at the same time.
Do not use conditional returns in Python code cells.
A code cell cannot display multiple charts at the same time.
Do not use any markdown syntax besides triple backticks for code cell language code blocks.
Do not reply code blocks in plain text, use markdown with triple backticks and language name code cell language.

${context.errored_code_cells.map(({ x, y, language, code_string, std_out, std_err }) => {
  const consoleOutput = {
    std_out: std_out ?? '',
    std_err: std_err ?? '',
  };
  return `
The code cell type is ${language}. The code cell is located at ${xyToA1(Number(x), Number(y))}.

The code in the code cell is:
\`\`\`${language}${code_string}\`\`\`

Code was run recently and the console output is:
\`\`\`markdown
${toMarkdown(consoleOutput, 'console_output')}
\`\`\`
`;
})}`;
      }
    } else {
      text = `The visible part of the sheet is empty.`;
    }

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text,
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
