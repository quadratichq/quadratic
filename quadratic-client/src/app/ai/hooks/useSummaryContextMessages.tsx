import { maxRects, maxRows } from '@/app/ai/constants/context';
import { AICellsToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { pluralize } from '@/app/helpers/pluralize';
import type { JsCellValueDescription } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { joinListWith } from '@/shared/components/JointListWith';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSummaryContextMessages() {
  const getSummaryContext = useCallback(
    async ({
      currentSheetName,
      allSheets = [],
      includeData = true,
    }: {
      currentSheetName: string;
      allSheets?: Sheet[];
      includeData?: boolean;
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
            includeDataRectsSummary: includeData,
          });
          flatDataRects = sheetContext?.[0]?.data_rects || [];
        }
      }

      // // Get other sheets with data and empty sheets
      // const otherSheetsWithData = allSheets
      //   .filter((sheet) => sheet.name !== currentSheetName)
      //   .filter((sheet) => {
      //     const sheetObj = sheets.getSheetByName(sheet.name);
      //     return sheetObj?.boundsWithoutFormatting?.type === 'nonEmpty';
      //   })
      //   .map((sheet) => sheet.name);

      // const otherEmptySheets = allSheets
      //   .filter((sheet) => sheet.name !== currentSheetName)
      //   .filter((sheet) => {
      //     const sheetObj = sheets.getSheetByName(sheet.name);
      //     return sheetObj?.boundsWithoutFormatting?.type !== 'nonEmpty';
      //   })
      //   .map((sheet) => sheet.name);

      // Categorize tables by sheet
      const currentSheetTables = dataTables.filter((table) => table.sheet_name === currentSheetName);
      const currentSheetCodeTables = codeTables.filter(
        (table) =>
          table.sheet_name === currentSheetName && !(typeof table.language === 'object' && table.language.Connection)
      );
      const currentSheetConnectionTables = codeTables.filter(
        (table) =>
          table.sheet_name === currentSheetName && typeof table.language === 'object' && table.language.Connection
      );
      const currentSheetCharts = charts.filter((chart) => chart.sheet_name === currentSheetName);

      // Build summary text
      const sheetCount = allSheets.length;
      // const dataSheetCount = (hasCurrentSheetData ? 1 : 0) + otherSheetsWithData.length; // only count current if it has data

      let summary = `# File Summary

## Sheets

File has ${sheetCount} ${pluralize('sheet', sheetCount)}, named ${joinListWith({ arr: allSheets.map((sheet) => `'${sheet.name}'`), conjunction: 'and' })}.`;

      summary += `

## '${currentSheetName}'

- user's current sheet
- ${sheets.getAISheetBounds(currentSheetName)}`;

      if (hasCurrentSheetData) {
        if (currentSheetTables.length > 0) {
          summary += `
- ${currentSheetTables.length} data ${pluralize('table', currentSheetTables.length)}`;
        }
        if (currentSheetCodeTables.length > 0) {
          summary += `
- ${currentSheetCodeTables.length} code ${pluralize('table', currentSheetCodeTables.length)}`;
        }
        if (currentSheetCharts.length > 0) {
          summary += `
- ${currentSheetCharts.length} ${pluralize('chart', currentSheetCharts.length)}`;
        }
        if (currentSheetConnectionTables.length > 0) {
          summary += `
- ${currentSheetConnectionTables.length} connection ${pluralize('table', currentSheetConnectionTables.length)}`;
        }
        summary += '\n';

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
${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
          if (table.last_rows_visible_values) {
            summary += `
Last rows of '${table.data_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
          }
        });

        if (currentSheetCodeTables.length > 0) {
          summary += `
### '${currentSheetName}' Code tables

These are the code tables that output more than one cell on the sheet:
`;

          currentSheetCodeTables.forEach((table) => {
            summary += `
#### ${table.code_table_name}

'${table.code_table_name}' is a ${table.language} table with bounds of ${table.bounds}.

First rows of '${table.code_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
            if (table.last_rows_visible_values) {
              summary += `
Last rows of '${table.code_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
            }
          });
        }

        if (currentSheetConnectionTables.length > 0) {
          summary += `
### '${currentSheetName}' Connection tables

These are the connection tables on the sheet:
`;

          currentSheetConnectionTables.forEach((table) => {
            if (typeof table.language !== 'object' || !table.language.Connection) return;
            summary += `
#### ${table.code_table_name}

'${table.code_table_name}' is a connection table of type ${table.language.Connection.kind} with bounds of ${table.bounds}.

First rows of '${table.code_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
            if (table.last_rows_visible_values) {
              summary += `
Last rows of '${table.code_table_name}' (limited to ${maxRows} rows):
${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
            }
          });
        }

        if (currentSheetCharts.length > 0) {
          summary += `
### '${currentSheetName}' Charts

These are the charts on the sheet:
`;

          currentSheetCharts.forEach((chart) => {
            summary += `
#### ${chart.chart_name}

'${chart.chart_name}' is a code cell of type ${chart.language} that creates a chart with bounds of ${chart.bounds}.
`;
          });
        }

        if (flatDataRects.length > 0) {
          summary += `
### '${currentSheetName}' Flat data

This is the flat data on the sheet (limited to ${maxRows} rows each):
`;

          flatDataRects.forEach((description) => {
            summary += `
${AICellsToMarkdown(description, true)}`;
          });
        }

        const sheetList = sheets.sheets.flatMap((sheet) => {
          if (sheet.name === currentSheetName) {
            return [];
          }
          return [sheet.name];
        });

        if (sheetList.length > 0) {
          summary += `
## Other sheets

Use get_cell_data tool to get more information about the data in these sheets.
`;
        }

        for (const sheet of sheetList) {
          summary += `
### ${sheet}

- ${sheets.getAISheetBounds(sheet)}`;
          const sheetDataTables = dataTables.filter((table) => table.sheet_name === sheet);
          const sheetCodeTables = codeTables.filter((table) => table.sheet_name === sheet);
          const sheetCharts = charts.filter((chart) => chart.sheet_name === sheet);
          if (sheetDataTables.length > 0) {
            summary += `
- ${sheetDataTables.length} data ${pluralize('table', sheetDataTables.length)}, named ${joinListWith({ arr: sheetDataTables.map((table) => `'${table.data_table_name}' (${table.bounds})`), conjunction: 'and' })}`;
          }
          if (sheetCodeTables.length > 0) {
            summary += `
- ${sheetCodeTables.length} code ${pluralize('table', sheetCodeTables.length)}, named ${joinListWith({ arr: sheetCodeTables.map((table) => `'${table.code_table_name}' (${table.bounds})`), conjunction: 'and' })}`;
          }
          if (sheetCharts.length > 0) {
            summary += `
- ${sheetCharts.length} ${pluralize('chart', sheetCharts.length)}, named ${joinListWith({ arr: sheetCharts.map((chart) => `'${chart.chart_name}' (${chart.bounds})`), conjunction: 'and' })}`;
          }
          summary += `\n`;
        }
      }

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
              text: `I understand the file structure summary. If asked to solve a data problem, I will first use get_cell_data tool to view complete data in my current sheet. Then I will use the appropriate cell references to access the data and write code and formulas to solve the problem. I will search the web if needed and make full appropriate use of my tools as needed to solve problems. How can I help you?`,
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
