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
          includeDataRectsSummary: true,
        });

    let text = `
# What the user can see

- the user is in sheet '${sheetName}'
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
