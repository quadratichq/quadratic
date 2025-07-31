import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { maxRects } from '@/app/ui/menus/AIAnalyst/const/maxRects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSummaryContextMessages() {
  const getSummaryContext = useCallback(
    async ({
      currentSheetName,
      allSheets = [],
    }: {
      currentSheetName: string;
      allSheets?: Sheet[];
    }): Promise<ChatMessage[]> => {
      if (!fileHasData()) {
        return [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Summary: Empty file with no data. Current sheet: '${currentSheetName}'. Use q.cells() to reference data.`,
              },
            ],
            contextType: 'tables',
          },
        ];
      }

      // Get tables context
      const tablesContext = await quadraticCore.getAITablesContext();
      const dataTables = tablesContext?.flatMap((tx) => tx.data_tables) || [];
      const codeTables = tablesContext?.flatMap((tx) => tx.code_tables) || [];
      const charts = tablesContext?.flatMap((tx) => tx.charts) || [];

      // Get current sheet context for flat data
      const currentSheet = sheets.getSheetByName(currentSheetName);
      const currentSheetBounds = currentSheet?.boundsWithoutFormatting;
      const hasCurrentSheetData = currentSheetBounds?.type === 'nonEmpty';

      // Get flat data rectangles for current sheet
      let flatDataRects: any[] = [];
      if (hasCurrentSheetData && currentSheet) {
        const selection = getAllSelection(currentSheet.id);
        if (selection) {
          const sheetContext = await quadraticCore.getAISelectionContexts({
            selections: [selection],
            maxRects,
            includeErroredCodeCells: false,
            includeTablesSummary: false,
            includeChartsSummary: false,
          });
          flatDataRects = sheetContext?.[0]?.data_rects || [];
        }
      }

      // Get other sheets with data and empty sheets
      const otherSheetsWithData = allSheets
        .filter((sheet) => sheet.name !== currentSheetName)
        .filter((sheet) => {
          const sheetObj = sheets.getSheetByName(sheet.name);
          return sheetObj?.boundsWithoutFormatting?.type === 'nonEmpty';
        })
        .map((sheet) => sheet.name);

      const otherEmptySheets = allSheets
        .filter((sheet) => sheet.name !== currentSheetName)
        .filter((sheet) => {
          const sheetObj = sheets.getSheetByName(sheet.name);
          return sheetObj?.boundsWithoutFormatting?.type !== 'nonEmpty';
        })
        .map((sheet) => sheet.name);

      // Categorize tables by sheet
      const currentSheetTables = dataTables.filter((table) => table.sheet_name === currentSheetName);
      const currentSheetCodeTables = codeTables.filter((table) => table.sheet_name === currentSheetName);
      const currentSheetCharts = charts.filter((chart) => chart.sheet_name === currentSheetName);

      // Build summary text
      const sheetCount = allSheets.length;
      const dataSheetCount = (hasCurrentSheetData ? 1 : 0) + otherSheetsWithData.length; // only count current if it has data

      let summary = `Summary: File has ${sheetCount} sheet${sheetCount !== 1 ? 's' : ''}`;

      if (dataSheetCount > 1) {
        summary += ` (${dataSheetCount} with data)`;
      }

      if (hasCurrentSheetData) {
        summary += `. Current sheet: '${currentSheetName}'`;
      } else {
        summary += `. Current sheet: '${currentSheetName}' is empty`;
      }

      if (!hasCurrentSheetData && otherSheetsWithData.length === 0) {
        summary += `. No data in any sheets.`;
      } else {
        if (hasCurrentSheetData) {
          const tableInfo = [];
          if (currentSheetTables.length > 0) {
            tableInfo.push(`${currentSheetTables.length} data table${currentSheetTables.length !== 1 ? 's' : ''}`);
          }
          if (currentSheetCodeTables.length > 0) {
            tableInfo.push(
              `${currentSheetCodeTables.length} code table${currentSheetCodeTables.length !== 1 ? 's' : ''}`
            );
          }
          if (currentSheetCharts.length > 0) {
            tableInfo.push(`${currentSheetCharts.length} chart${currentSheetCharts.length !== 1 ? 's' : ''}`);
          }

          if (tableInfo.length > 0) {
            summary += ` has ${tableInfo.join(', ')}.`;
          } else {
            summary += ` has data.`;
          }
        }

        if (otherSheetsWithData.length > 0) {
          summary += ` Sheets with data: ${otherSheetsWithData.map((name) => `'${name}'`).join(', ')}.`;
        }

        if (otherEmptySheets.length > 0) {
          summary += ` Empty sheets: ${otherEmptySheets.map((name) => `'${name}'`).join(', ')}.`;
        }
      }

      // Add table names with ranges for easy reference
      const allDataTablesWithRanges = dataTables.map(
        (table) => `${table.data_table_name} (${table.bounds}) on '${table.sheet_name}'`
      );
      if (allDataTablesWithRanges.length > 0) {
        summary += `\nAvailable data tables: ${allDataTablesWithRanges.join(', ')}.`;
      }

      // Add code table names with ranges
      const allCodeTablesWithRanges = codeTables.map(
        (table) => `${table.code_table_name || 'Unnamed'} (${table.bounds}) on '${table.sheet_name}'`
      );
      if (allCodeTablesWithRanges.length > 0) {
        summary += `\nAvailable code tables: ${allCodeTablesWithRanges.join(', ')}.`;
      }

      // Add flat data rectangles with ranges
      const flatDataWithRanges = flatDataRects.map((rect) => {
        const endCol = String.fromCharCode(rect.rect_origin.charCodeAt(0) + rect.rect_width - 1);
        const endRow = parseInt(rect.rect_origin.slice(1)) + rect.rect_height - 1;
        const range = `${rect.rect_origin}:${endCol}${endRow}`;
        return `${range} on '${rect.sheet_name}'`;
      });
      if (flatDataWithRanges.length > 0) {
        summary += `\nAvailable flat data: ${flatDataWithRanges.join(', ')}.`;
      }

      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
          contextType: 'tables',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `I understand the file structure summary. If asked to solve a data problem, I will first use get_cell_data tool to view the data in my current sheet. Then I will use the appropriate cell references to access the data and write code and formulas to solve the problem. I will search the web if needed and make full appropriate use of my tools as needed to solve problems. How can I help you?`,
            },
          ],
          contextType: 'tables',
        },
      ];
    },
    []
  );

  return { getSummaryContext };
}
