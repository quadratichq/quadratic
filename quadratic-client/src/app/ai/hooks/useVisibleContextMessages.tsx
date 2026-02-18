import { sheets } from '@/app/grid/controller/Sheets';
import { getRectSelection } from '@/app/grid/sheet/selection';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useVisibleContextMessages() {
  const getVisibleContext = useCallback(async (): Promise<ChatMessage[]> => {
    const sheetName = sheets.sheet.name;
    const visibleRect = pixiApp.getVisibleRect();
    const visibleRectSelection = getRectSelection(sheets.current, visibleRect);
    const jsSelection = sheets.A1SelectionStringToSelection(visibleRectSelection);
    jsSelection.free();

    const sheetBounds = sheets.sheet.boundsWithoutFormatting;
    const isVisibleEmpty = sheetBounds.type === 'empty' || !intersects.rectRect(sheetBounds, visibleRect);
    const visibleContext = isVisibleEmpty
      ? undefined
      : await quadraticCore.getAISelectionContexts({
          selections: [visibleRectSelection],
          maxRows: undefined,
        });
    const sheetContext = visibleContext?.length === 1 ? visibleContext[0] : undefined;

    let text = `
# What the user can see

- the user is in sheet '${sheetName}'
- their cursor is located at ${sheets.sheet.cursor.a1String()}
- their selection is ${sheets.getA1String(sheets.current)}
`;

    if (sheetContext) {
      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        text += `
## Data Tables in the visible area

`;
        for (const table of sheetContext.data_tables) {
          text += `- '${table.data_table_name}' has bounds of (${table.bounds})\n`;
        }
      }

      if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
        text += `
### Code tables in the visible area

`;
        for (const table of sheetContext.code_tables) {
          text += `- '${table.code_table_name}' is a ${table.language} table with bounds of ${table.bounds}\n`;
        }
      }

      if (sheetContext.connections && sheetContext.connections.length > 0) {
        text += `
### Connections in the visible area

`;
        for (const table of sheetContext.connections) {
          if (typeof table.language !== 'object' || !table.language.Connection) {
            console.warn('Unexpected non-connection table in useSummaryContextMessages');
            continue;
          }
          text += `- '${table.code_table_name}' is a connection table of type ${table.language.Connection.kind} with bounds of ${table.bounds}\n`;
        }
      }

      if (sheetContext.charts && sheetContext.charts.length > 0) {
        text += `
### Charts in the visible area

`;
        for (const chart of sheetContext.charts) {
          text += `- '${chart.chart_name}' is a code cell of type ${chart.language} that creates a chart with bounds of ${chart.bounds}\n`;
        }
      }

      if (sheetContext.data_rects && sheetContext.data_rects.length > 0) {
        text += `
### Flat data in the visible area

`;
        for (const data of sheetContext.data_rects) {
          text += `- data on the sheet at ${data.total_range}\n`;
        }
      }

      if (sheetContext.merge_cells && sheetContext.merge_cells.length > 0) {
        text += `
### Merged cells in the visible area

Values in merged regions can only be written to the anchor (top-left) cell.
`;
        for (const merge of sheetContext.merge_cells) {
          const anchor = merge.split(':')[0];
          text += `- ${merge} (anchor: ${anchor})\n`;
        }
      }
    }

    return [
      {
        role: 'user',
        content: [createTextContent(text)],
        contextType: 'visibleData',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the visible data, I will reference it to answer following messages. How can I help you?`
          ),
        ],
        contextType: 'visibleData',
      },
    ];
  }, []);

  return { getVisibleContext };
}
