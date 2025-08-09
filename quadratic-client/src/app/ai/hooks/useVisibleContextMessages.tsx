import { maxRects, maxRows } from '@/app/ai/constants/context';
import { sheets } from '@/app/grid/controller/Sheets';
import { getRectSelection } from '@/app/grid/sheet/selection';
import { intersects } from '@/app/gridGL/helpers/intersects';
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

- they are in sheet '${sheetName}'
- they see cells in ${visibleA1String}
- their cursor is located at ${sheets.sheet.cursor.a1String()}
- their selection is ${sheets.getA1String(sheets.current)}`;

    if (!!visibleContext && visibleContext.length === 1) {
      const context = visibleContext[0];
      if (context.tables_summary && context.tables_summary.length > 0) {
        text += `

## Tables and Code Summary

The user can see the following tables in the viewport:`;

        for (const table of context.tables_summary) {
          text += `
- ${
            table.table_type === 'python'
              ? 'a Python table'
              : table.table_type === 'javascript'
                ? 'a JavaScript table'
                : table.table_type === 'formula'
                  ? 'a Formula table'
                  : table.table_type === 'connection'
                    ? `a connection of type ${table.connection_name}`
                    : 'a Data table'
          } named '${table.table_name}', with bounds of ${table.bounds}`;
        }
      }

      if (context.charts_summary && context.charts_summary.length > 0) {
        text += `

## Chart Summary

The user can see the following charts in the viewport:`;
        for (const chart of context.charts_summary) {
          text += `
- a chart named ${chart.chart_name} with bounds of ${chart.bounds}`;
        }
      }

      // ## Data Summary
      // The user can see the following data in the viewport. Note, the data may be limited. We only provide ${maxRects} rectangles of data, and the first ${maxRows} rows of data within each rectangle:`;

      //         for (const dataRect of context.data_rects) {
      //           text += `
      // - Data rectangle starting at ${dataRect.range} with ${dataRect.values.length}x${dataRect.values[0].length} cells. Here is some of values in this rectangle: `;
      //           if (dataRect.values) {
      //             text += dataRect.values.map((row) => row.map((cell) => cell.value).join(', ')).join('\n');
      //           }
      //         }

      //       if (context.errored_code_cells && context.errored_code_cells.length > 0) {
      //         text += `
      // ## Errored Code Cells
      // There are code cells in the visible part of the sheet that have errors. Use this to understand if the code cell has any errors and take action when prompted by user to specifically solve the error.

      // For Python cells, add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.
      // Use any functions that are part of the code cell language library.
      // A code cell can return only one type of value as specified in the Quadratic documentation.
      // A code cell cannot display both a chart and return a data frame at the same time.
      // Do not use conditional returns in Python code cells.
      // A code cell cannot display multiple charts at the same time.
      // Do not use any markdown syntax besides triple backticks for code cell language code blocks.
      // Do not reply code blocks in plain text, use markdown with triple backticks and language name code cell language.

      // ${context.errored_code_cells.map(({ x, y, language, code_string, std_out, std_err }) => {
      //   const consoleOutput = {
      //     std_out: std_out ?? '',
      //     std_err: std_err ?? '',
      //   };
      //   return `
      // The code cell type is ${language}. The code cell is located at ${xyToA1(Number(x), Number(y))}.

      // The code in the code cell is:
      // \`\`\`${language}${code_string}\`\`\`

      // Code was run recently and the console output is:
      // \`\`\`markdown
      // ${toMarkdown(consoleOutput, 'console_output')}
      // \`\`\`
      // `;
      // })}`;
      // } else {
      //   text = `The visible part of the sheet is empty.`;
    }

    console.log(text);
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
