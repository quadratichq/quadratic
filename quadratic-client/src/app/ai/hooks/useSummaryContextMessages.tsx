import { MAX_ROWS } from '@/app/ai/constants/context';
import { AICellsToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { pluralize } from '@/app/helpers/pluralize';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { joinListWith } from '@/shared/components/JointListWith';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSummaryContextMessages() {
  const getSummaryContext = useCallback(async (): Promise<ChatMessage[]> => {
    if (!fileHasData()) {
      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Summary: Empty file with no data. Current sheet: '${sheets.sheet.name}'.`,
            },
          ],
          contextType: 'fileSummary',
        },
      ];
    }

    // Get all data from sheets
    const selections = sheets.sheets.map((sheet) => sheets.stringToSelection('*', sheet.id).save());
    const sheetsContext = await quadraticCore.getAISelectionContexts({
      selections,
      maxRows: MAX_ROWS,
    });

    if (!sheetsContext) {
      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Summary: Failed to get context from sheets. Please try again.',
            },
          ],
          contextType: 'fileSummary',
        },
      ];
    }
    // sort so current sheet is first in list
    sheetsContext.sort((a, b) => {
      if (a.sheet_name === sheets.sheet.name) {
        return -1;
      } else if (b.sheet_name === sheets.sheet.name) {
        return 1;
      } else {
        return 0;
      }
    });
    console.log(sheetsContext);
    //       // Categorize tables by sheet
    //       const currentSheetTables = dataTables.filter((table) => table.sheet_name === currentSheetName);
    //       const currentSheetCodeTables = codeTables.filter(
    //         (table) =>
    //           table.sheet_name === currentSheetName && !(typeof table.language === 'object' && table.language.Connection)
    //       );
    //       const currentSheetConnectionTables = codeTables.filter(
    //         (table) =>
    //           table.sheet_name === currentSheetName && typeof table.language === 'object' && table.language.Connection
    //       );
    //       const currentSheetCharts = charts.filter((chart) => chart.sheet_name === currentSheetName);

    //       // Build summary text
    //       const sheetCount = allSheets.length;
    //       // const dataSheetCount = (hasCurrentSheetData ? 1 : 0) + otherSheetsWithData.length; // only count current if it has data

    const sheetCount = sheets.sheets.length;
    let summary = `# File Summary

      ## Sheets

      File has ${sheetCount} ${pluralize('sheet', sheetCount)}, named ${joinListWith({ arr: sheets.sheets.map((sheet) => `'${sheet.name}'`), conjunction: 'and' })}.
`;

    let rects = 0;
    for (const sheetContext of sheetsContext) {
      let sheet = sheets.getSheetByName(sheetContext.sheet_name);
      if (!sheet) continue;

      summary += `
      ## '${sheetContext.sheet_name}' summary
      `;
      if (sheetContext.sheet_name === sheets.sheet.name) {
        summary += `- user's current sheet`;
      }
      summary += `
- ${sheets.getAISheetBounds(sheetContext.sheet_name)}`;

      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        summary += `- ${sheetContext.data_tables.length} data ${pluralize('table', sheetContext.data_tables.length)}`;
      }
      if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
        summary += `
    - ${sheetContext.code_tables.length} code ${pluralize('table', sheetContext.code_tables.length)}`;
      }
      if (sheetContext.charts && sheetContext.charts.length > 0) {
          summary += `
    - ${sheetContext.charts.length} ${pluralize('chart', sheetContext.charts.length)}`;
        }
        if (sheetContext.connections && sheetContext.connections.length > 0) {
          summary += `
    - ${sheetContext.connections.length} connection ${pluralize('table', sheetContext.connections.length)}`;
        }
        summary += '\n';

      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        summary += `
    ### '${sheetContext.sheet_name}' Data tables:
    `;

        sheetContext.data_tables.forEach((table) => {
          summary += `
    #### ${table.data_table_name}

    '${table.data_table_name}' has bounds of (${table.bounds}).

    First rows of '${table.data_table_name}' (limited to ${MAX_ROWS} rows):
    ${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
          if (table.last_rows_visible_values) {
            summary += `
    Last rows of '${table.data_table_name}' (limited to ${MAX_ROWS} rows):
    ${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
          }
        });
      }
    //         if (currentSheetCodeTables.length > 0) {
    //           summary += `
    // ### '${currentSheetName}' Code tables

    // These are the code tables that output more than one cell on the sheet:
    // `;

    //           currentSheetCodeTables.forEach((table) => {
    //             summary += `
    // #### ${table.code_table_name}

    // '${table.code_table_name}' is a ${table.language} table with bounds of ${table.bounds}.

    // First rows of '${table.code_table_name}' (limited to ${maxRows} rows):
    // ${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
    //             if (table.last_rows_visible_values) {
    //               summary += `
    // Last rows of '${table.code_table_name}' (limited to ${maxRows} rows):
    // ${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
    //             }
    //           });
    //         }

    //         if (currentSheetConnectionTables.length > 0) {
    //           summary += `
    // ### '${currentSheetName}' Connection tables

    // These are the connection tables on the sheet:
    // `;

    //           currentSheetConnectionTables.forEach((table) => {
    //             if (typeof table.language !== 'object' || !table.language.Connection) return;
    //             summary += `
    // #### ${table.code_table_name}

    // '${table.code_table_name}' is a connection table of type ${table.language.Connection.kind} with bounds of ${table.bounds}.

    // First rows of '${table.code_table_name}' (limited to ${maxRows} rows):
    // ${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
    //             if (table.last_rows_visible_values) {
    //               summary += `
    // Last rows of '${table.code_table_name}' (limited to ${maxRows} rows):
    // ${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
    //             }
    //           });
    //         }

    //         if (currentSheetCharts.length > 0) {
    //           summary += `
    // ### '${currentSheetName}' Charts

    // These are the charts on the sheet:
    // `;

    //           currentSheetCharts.forEach((chart) => {
    //             summary += `
    // #### ${chart.chart_name}

    // '${chart.chart_name}' is a code cell of type ${chart.language} that creates a chart with bounds of ${chart.bounds}.
    // `;
    //           });
    //         }

    //         if (flatDataRects.length > 0) {
    //           summary += `
    // ### '${currentSheetName}' Flat data

    // This is the flat data on the sheet (limited to ${maxRows} rows each):
    // `;

    //           flatDataRects.forEach((description) => {
    //             summary += `
    // ${AICellsToMarkdown(description, true)}`;
    //           });
    //         }

    //         const sheetList = sheets.sheets.flatMap((sheet) => {
    //           if (sheet.name === currentSheetName) {
    //             return [];
    //           }
    //           return [sheet.name];
    //         });

    //         if (sheetList.length > 0) {
    //           summary += `
    // ## Other sheets

    // Use get_cell_data tool to get more information about the data in these sheets.
    // `;
    //         }

    //         for (const sheet of sheetList) {
    //           summary += `
    // ### ${sheet}

    // - ${sheets.getAISheetBounds(sheet)}`;
    //           const sheetDataTables = dataTables.filter((table) => table.sheet_name === sheet);
    //           const sheetCodeTables = codeTables.filter((table) => table.sheet_name === sheet);
    //           const sheetCharts = charts.filter((chart) => chart.sheet_name === sheet);
    //           if (sheetDataTables.length > 0) {
    //             summary += `
    // - ${sheetDataTables.length} data ${pluralize('table', sheetDataTables.length)}, named ${joinListWith({ arr: sheetDataTables.map((table) => `'${table.data_table_name}' (${table.bounds})`), conjunction: 'and' })}`;
    //           }
    //           if (sheetCodeTables.length > 0) {
    //             summary += `
    // - ${sheetCodeTables.length} code ${pluralize('table', sheetCodeTables.length)}, named ${joinListWith({ arr: sheetCodeTables.map((table) => `'${table.code_table_name}' (${table.bounds})`), conjunction: 'and' })}`;
    //           }
    //           if (sheetCharts.length > 0) {
    //             summary += `
    // - ${sheetCharts.length} ${pluralize('chart', sheetCharts.length)}, named ${joinListWith({ arr: sheetCharts.map((chart) => `'${chart.chart_name}' (${chart.bounds})`), conjunction: 'and' })}`;
    //           }
    //           summary += `\n`;
    //         }
    //       }

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
        contextType: 'fileSummary',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `I understand the file structure summary. If asked to solve a data problem, I will check this context, and if I'm missing data, use get_cell_data tool to view more data in my current sheet. Then I will use the appropriate cell references to access the data and write code and formulas to solve the problem. I will search the web if needed and make full appropriate use of my tools as needed to solve problems. How can I help you?`,
          },
        ],
        contextType: 'fileSummary',
      },
    ];
  }, []);

  return { getSummaryContext };
}
