import { maxRects, maxRows } from '@/app/ai/constants/context';
import { AICellsToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import type { JsCellValueDescription } from '@/app/quadratic-core-types';
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
      let flatDataRects: JsCellValueDescription[] = [];
      if (hasCurrentSheetData && currentSheet) {
        const selection = getAllSelection(currentSheet.id);
        if (selection) {
          const sheetContext = await quadraticCore.getAISelectionContexts({
            selections: [selection],
            maxRects,
            maxRows,
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
      // const dataSheetCount = (hasCurrentSheetData ? 1 : 0) + otherSheetsWithData.length; // only count current if it has data

      let summary = `# File Summary

## Sheets

File has ${sheetCount} sheet${sheetCount !== 1 ? 's' : ''}, named ${allSheets.map((sheet) => `'${sheet.name}'`).join(', ')}.`;

      summary += `

## '${currentSheetName}'

This is the user's current sheet.

`;

      if (!hasCurrentSheetData && otherSheetsWithData.length === 0) {
        summary += `
There is no data in any sheets.`;
      } else {
        summary += `The sheet has `;
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
            summary += `${tableInfo.length > 2 ? tableInfo.slice(0, -1).join(', ') + ', and ' + tableInfo.slice(-1) : tableInfo.join(' and ')}.`;
          } else {
            summary += `only data.`;
          }
        }

        if (currentSheetTables.length > 0) {
          summary += `

### '${currentSheetName}' Data tables:
`;
        }
        currentSheetTables.forEach((table) => {
          summary += `
#### ${table.data_table_name}

'${table.data_table_name}' has bounds of (${table.bounds}).

First rows of '${table.data_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.first_rows_visible_values)}`;
          if (table.last_rows_visible_values) {
            summary += `
Last rows of '${table.data_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.last_rows_visible_values)}`;
          }
        });

        if (currentSheetCodeTables.length > 0) {
          summary += `
### '${currentSheetName}' Code tables

This is code on the sheet:
`;

          currentSheetCodeTables.forEach((table) => {
            summary += `
#### ${table.code_table_name}

'${table.code_table_name}' is a ${table.language} table with bounds of (${table.bounds}).

First rows of '${table.code_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.first_rows_visible_values)}`;
            if (table.last_rows_visible_values) {
              summary += `
Last rows of '${table.code_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.last_rows_visible_values)}`;
            }
          });
        }

        if (currentSheetCharts.length > 0) {
          summary += `

### '${currentSheetName}' Charts

This is a chart on the sheet:
`;

          currentSheetCharts.forEach((chart) => {
            summary += `
#### ${chart.chart_name}

'${chart.chart_name}' is a code cell of type ${chart.language} creating a chart with bounds of (${chart.bounds}).
`;
          });
        }

        if (flatDataRects.length > 0) {
          summary += `

### '${currentSheetName}' Flat data

This is flat data on the sheet (limited to ${maxRows} rows each):
`;

          flatDataRects.forEach((description) => {
            summary += `
${AICellsToMarkdown(description)}`;
          });
        }

        if (otherSheetsWithData.length > 0 || otherEmptySheets.length > 0) {
          summary += `
## Other Sheets
`;
        }
        if (otherSheetsWithData.length > 0) {
          summary += `
Sheets with data: ${otherSheetsWithData.map((name) => `'${name}'`).join(', ')}.`;
        }

        if (otherEmptySheets.length > 0) {
          summary += `
Empty sheets: ${otherEmptySheets.map((name) => `'${name}'`).join(', ')}.`;
        }
      }

      // // Add table names with ranges for easy reference
      // const allDataTablesWithRanges = dataTables.map(
      //   (table) => `${table.data_table_name} (${table.bounds}) on '${table.sheet_name}'`
      // );
      // if (allDataTablesWithRanges.length > 0) {
      //   summary += `\nAvailable data tables: ${allDataTablesWithRanges.join(', ')}.`;
      // }

      // // Add code table names with ranges
      // const allCodeTablesWithRanges = codeTables.map(
      //   (table) => `${table.code_table_name || 'Unnamed'} (${table.bounds}) on '${table.sheet_name}'`
      // );
      // if (allCodeTablesWithRanges.length > 0) {
      //   summary += `\nAvailable code tables: ${allCodeTablesWithRanges.join(', ')}.`;
      // }

      console.log(summary);
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
