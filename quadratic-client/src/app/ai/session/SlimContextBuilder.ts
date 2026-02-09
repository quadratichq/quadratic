import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { pluralize } from '@/app/helpers/pluralize';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { joinListWith } from '@/shared/components/JointListWith';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { ContextBuilder } from './ContextBuilder';

/**
 * SlimContextBuilder builds minimal AI context for the main agent.
 *
 * Key difference from ContextBuilder:
 * - getSummaryContext() includes table names and bounds but NO cell values
 * - getVisibleContext() uses maxRows: 0 so no cell values are fetched
 * - This significantly reduces context size for files with lots of data
 * - Main agent can use delegate_to_subagent to explore data when needed
 */
export class SlimContextBuilder extends ContextBuilder {
  protected override get builderName(): string {
    return 'SlimContextBuilder';
  }

  protected override getVisibleContextMaxRows(): number | undefined {
    return 0;
  }

  /**
   * Get slim file summary context - table names and bounds only, NO cell values.
   * Overrides ContextBuilder.getSummaryContext to avoid including cell data.
   */
  override async getSummaryContext(): Promise<ChatMessage[]> {
    if (!fileHasData()) {
      return [
        {
          role: 'user',
          content: [createTextContent(`Summary: Empty file with no data`)],
          contextType: 'fileSummary',
        },
      ];
    }

    const selections = sheets.sheets.map((sheet) => sheets.stringToSelection('*', sheet.id).save());
    const sheetsContext = await quadraticCore.getAISelectionContexts({
      selections,
      maxRows: 0,
    });

    if (!sheetsContext) {
      return [
        {
          role: 'user',
          content: [createTextContent('Summary: Failed to get context from sheets. Please try again.')],
          contextType: 'fileSummary',
        },
      ];
    }

    sheetsContext.sort((a, b) => {
      if (a.sheet_name === sheets.sheet.name) return -1;
      if (b.sheet_name === sheets.sheet.name) return 1;
      return 0;
    });

    const sheetCount = sheets.sheets.length;
    let text = `# File Summary

## Sheets

File has ${sheetCount} ${pluralize('sheet', sheetCount)}, named ${joinListWith({ arr: sheets.sheets.map((sheet) => `'${sheet.name}'`), conjunction: 'and' })}.
`;

    for (const sheetContext of sheetsContext) {
      const sheet = sheets.getSheetByName(sheetContext.sheet_name);
      if (!sheet) continue;

      text += `
## '${sheetContext.sheet_name}' summary\n\n`;
      if (sheetContext.sheet_name === sheets.sheet.name) {
        text += `- user's current sheet\n`;
      }
      text += `- ${sheets.getAISheetBounds(sheetContext.sheet_name)}\n`;
      text += `- default column width: ${sheetContext.default_column_width}px, default row height: ${sheetContext.default_row_height}px\n`;

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

      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        text += `### '${sheetContext.sheet_name}' Data tables:\n`;
        for (const table of sheetContext.data_tables) {
          text += `- '${table.data_table_name}' at ${table.bounds}\n`;
        }
      }

      if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
        text += `\n### '${sheet.name}' Code tables:\n`;
        for (const table of sheetContext.code_tables) {
          text += `- '${table.code_table_name}' (${table.language}) at ${table.bounds}\n`;
        }
      }

      if (sheetContext.connections && sheetContext.connections.length > 0) {
        text += `\n### '${sheet.name}' Connection tables:\n`;
        for (const table of sheetContext.connections) {
          if (typeof table.language !== 'object' || !table.language.Connection) {
            console.warn('Unexpected non-connection table in getSummaryContext');
            continue;
          }
          text += `- '${table.code_table_name}' (${table.language.Connection.kind}) at ${table.bounds}\n`;
        }
      }

      if (sheetContext.charts && sheetContext.charts.length > 0) {
        text += `\n### '${sheet.name}' Charts:\n`;
        for (const chart of sheetContext.charts) {
          text += `- '${chart.chart_name}' (${chart.language}) at ${chart.bounds}\n`;
        }
      }

      if (sheetContext.data_rects && sheetContext.data_rects.length > 0) {
        text += `\n### '${sheet.name}' Flat data:\n`;
        for (const data of sheetContext.data_rects) {
          text += `- data at ${data.total_range}\n`;
        }
      }
      text += `\n`;
    }

    text += `
NOTE: To explore cell contents or find specific data, use the delegate_to_subagent tool with type 'data_finder'.
`;

    return [
      {
        role: 'user',
        content: [createTextContent(text)],
        contextType: 'fileSummary',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the file structure summary showing table names and locations. When I need to explore cell contents or find specific data, I will use the delegate_to_subagent tool with type 'data_finder'. How can I help you?`
          ),
        ],
        contextType: 'fileSummary',
      },
    ];
  }
}

export const slimContextBuilder = new SlimContextBuilder();
