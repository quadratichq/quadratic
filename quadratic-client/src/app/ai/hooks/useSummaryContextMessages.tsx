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

    const sheetCount = sheets.sheets.length;
    let text = `# File Summary

      ## Sheets

      File has ${sheetCount} ${pluralize('sheet', sheetCount)}, named ${joinListWith({ arr: sheets.sheets.map((sheet) => `'${sheet.name}'`), conjunction: 'and' })}.
`;

    for (const sheetContext of sheetsContext) {
      let sheet = sheets.getSheetByName(sheetContext.sheet_name);
      if (!sheet) continue;

      text += `
      ## '${sheetContext.sheet_name}' summary\n`;
      if (sheetContext.sheet_name === sheets.sheet.name) {
        text += `- user's current sheet\n`;
      }
      text += `- ${sheets.getAISheetBounds(sheetContext.sheet_name)}\n`;

      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        text += `- ${sheetContext.data_tables.length} data ${pluralize('table', sheetContext.data_tables.length)}\n`;
      }
      if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
        text += `- ${sheetContext.code_tables.length} code ${pluralize('table', sheetContext.code_tables.length)}\n`;
      }
      if (sheetContext.charts && sheetContext.charts.length > 0) {
        text += `- ${sheetContext.charts.length} ${pluralize('chart', sheetContext.charts.length)}\n`;
      }
      if (sheetContext.connections && sheetContext.connections.length > 0) {
        text += `- ${sheetContext.connections.length} connection ${pluralize('table', sheetContext.connections.length)}\n`;
      }
      text += '\n';

      // Data Tables
      // -----------
      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        text += `
    ### '${sheetContext.sheet_name}' Data tables:
    `;

        for (const table of sheetContext.data_tables) {
          text += `
#### ${table.data_table_name}

'${table.data_table_name}' has bounds of (${table.bounds}).
`;
          // add data if available
          if (table.first_rows_visible_values) {
            text += `
First rows of '${table.data_table_name}' (limited to ${MAX_ROWS} rows):
${AICellsToMarkdown(table.first_rows_visible_values, false)}`;

            if (table.last_rows_visible_values) {
              text += `
Last rows of '${table.data_table_name}' (limited to ${MAX_ROWS} rows):
${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
            }
          }
        }
      }

      // Code Tables
      // -----------
      if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
        text += `
### '${sheet.name}' Code tables

These are the code tables that output more than one cell on the sheet:
        `;

        for (const table of sheetContext.code_tables) {
          text += `
#### ${table.code_table_name}

'${table.code_table_name}' is a ${table.language} table with bounds of ${table.bounds}.
`;
          // add data if available
          if (table.first_rows_visible_values) {
            text += `
First rows of '${table.code_table_name}' (limited to ${MAX_ROWS} rows):
${AICellsToMarkdown(table.first_rows_visible_values, false)}`;

            if (table.last_rows_visible_values) {
              text += `
Last rows of '${table.code_table_name}' (limited to ${MAX_ROWS} rows):
${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
            }
          }
        }
      }

      // Connection Tables
      // -----------------
      if (sheetContext.connections && sheetContext.connections.length > 0) {
        text += `
### '${sheet.name}' Connection tables

These are the connection tables on the sheet:
`;

        for (const table of sheetContext.connections) {
          if (typeof table.language !== 'object' || !table.language.Connection) {
            console.warn('Unexpected non-connection table in useSummaryContextMessages');
            break;
          }
          text += `
#### ${table.code_table_name}

'${table.code_table_name}' is a connection table of type ${table.language.Connection.kind} with bounds of ${table.bounds}.
`;
          if (table.first_rows_visible_values) {
            text += `
First rows of '${table.code_table_name}' (limited to ${MAX_ROWS} rows):
${AICellsToMarkdown(table.first_rows_visible_values, false)}`;
            if (table.last_rows_visible_values) {
              text += `
Last rows of '${table.code_table_name}' (limited to ${MAX_ROWS} rows):
${AICellsToMarkdown(table.last_rows_visible_values, false)}`;
            }
          }
        }
      }

      // Charts
      // ------
      if (sheetContext.charts && sheetContext.charts.length > 0) {
        text += `
        ### '${sheet.name}' Charts

These are the charts on the sheet:
`;

        for (const chart of sheetContext.charts) {
          text += `
#### ${chart.chart_name}

'${chart.chart_name}' is a code cell of type ${chart.language} that creates a chart with bounds of ${chart.bounds}.
    `;
        }
      }

      // Flat Data
      if (sheetContext.data_rects && sheetContext.data_rects.length > 0) {
        text += `
### '${sheet.name}' Flat data

This is the flat data on the sheet (limited to ${MAX_ROWS} rows each):
`;

        for (const data of sheetContext.data_rects) {
          text += `${AICellsToMarkdown(data, true)}\n`;
        }
      }
      text += `\n`;
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
