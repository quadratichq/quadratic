import { MAX_ROWS } from '@/app/ai/constants/context';
import { isCodingSubagent, SubagentType } from '@/app/ai/subagent/subagentTypes';
import { getAICellSummaryToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { pluralize } from '@/app/helpers/pluralize';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';

/**
 * SubagentContextBuilder builds rich context for subagents.
 *
 * Key difference from SlimContextBuilder:
 * - Includes cell values for the CURRENT sheet only
 * - Other sheets show only names and bounds (progressive loading)
 * - Subagent can use get_sheet_data tool to load other sheets on demand
 */
export class SubagentContextBuilder {
  /**
   * Build context for a subagent based on its type.
   * - DataFinder: Full sheet context with cell values
   * - Coding subagents: Slim sheet overview (structure only) plus context_hints; no cell values
   */
  async buildContext(task: string, contextHints?: string, subagentType?: SubagentType): Promise<ChatMessage[]> {
    // For coding subagents, use a lighter context that relies on context_hints
    if (isCodingSubagent(subagentType)) {
      return this.buildCodingSubagentContext(task, contextHints);
    }

    // For DataFinder and other exploration subagents, use full sheet context
    return this.buildDataExplorationContext(task, contextHints);
  }

  /**
   * Build context for coding subagents.
   * Includes a slim sheet overview (names and bounds only, no cell values) so
   * coding subagents have reliable structure awareness without depending on
   * context_hints. Data details still come from context_hints or tools.
   */
  private async buildCodingSubagentContext(task: string, contextHints?: string): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    messages.push(...this.getCurrentDateTimeContext());

    const currentSheetSlim = await this.getCurrentSheetSlimOverview();
    if (currentSheetSlim.length > 0) {
      messages.push(...currentSheetSlim);
    }

    const otherSheetsContext = await this.getOtherSheetsOverview();
    messages.push(...otherSheetsContext);

    messages.push(this.getTaskMessage(task, contextHints));

    return messages;
  }

  /**
   * Get current sheet structure only (names and bounds, no cell values).
   * Used by coding subagents to know where tables/charts are without paying for full cell context.
   */
  private async getCurrentSheetSlimOverview(): Promise<ChatMessage[]> {
    if (!fileHasData()) {
      return [
        {
          role: 'user',
          content: [createTextContent(`The current sheet is empty.`)],
          contextType: 'fileSummary',
        },
      ];
    }

    const currentSheet = sheets.sheet;
    const selection = sheets.stringToSelection('*', currentSheet.id).save();

    const sheetContexts = await quadraticCore.getAISelectionContexts({
      selections: [selection],
      maxRows: 0,
    });

    if (!sheetContexts || sheetContexts.length === 0) {
      return [];
    }

    const sheetContext = sheetContexts[0];
    let text = `# Current Sheet: '${sheetContext.sheet_name}'

- Bounds: ${sheets.getAISheetBounds(sheetContext.sheet_name)}
`;

    const tableCount =
      (sheetContext.data_tables?.length ?? 0) +
      (sheetContext.code_tables?.length ?? 0) +
      (sheetContext.connections?.length ?? 0);

    if (tableCount > 0) {
      text += `- Tables: `;
      const parts = [];
      if (sheetContext.data_tables?.length) {
        parts.push(`${sheetContext.data_tables.length} data ${pluralize('table', sheetContext.data_tables.length)}`);
      }
      if (sheetContext.code_tables?.length) {
        parts.push(`${sheetContext.code_tables.length} code ${pluralize('table', sheetContext.code_tables.length)}`);
      }
      if (sheetContext.connections?.length) {
        parts.push(
          `${sheetContext.connections.length} connection ${pluralize('table', sheetContext.connections.length)}`
        );
      }
      text += parts.join(', ') + '\n\n';

      if (sheetContext.data_tables?.length) {
        for (const table of sheetContext.data_tables) {
          text += `- Data table '${table.data_table_name}' at ${table.bounds}\n`;
        }
      }
      if (sheetContext.code_tables?.length) {
        for (const table of sheetContext.code_tables) {
          text += `- Code table '${table.code_table_name}' (${table.language}) at ${table.bounds}\n`;
        }
      }
      if (sheetContext.connections?.length) {
        for (const table of sheetContext.connections) {
          if (typeof table.language === 'object' && table.language.Connection) {
            text += `- Connection '${table.code_table_name}' at ${table.bounds}\n`;
          }
        }
      }
    }

    if (sheetContext.charts?.length) {
      text += `\n- Charts: ${sheetContext.charts.length}\n`;
      for (const chart of sheetContext.charts) {
        text += `  - '${chart.chart_name}' (${chart.language}) at ${chart.bounds}\n`;
      }
    }

    return [
      {
        role: 'user',
        content: [createTextContent(text)],
        contextType: 'fileSummary',
      },
    ];
  }

  /**
   * Build context for data exploration subagents (DataFinder).
   * These subagents need full sheet context to explore data.
   */
  private async buildDataExplorationContext(task: string, contextHints?: string): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Add current date
    messages.push(...this.getCurrentDateTimeContext());

    // Add current sheet context with cell values
    const currentSheetContext = await this.getCurrentSheetContext();
    messages.push(...currentSheetContext);

    // Add other sheets overview (names and bounds only)
    const otherSheetsContext = await this.getOtherSheetsOverview();
    messages.push(...otherSheetsContext);

    // Add the task message
    messages.push(this.getTaskMessage(task, contextHints));

    return messages;
  }

  /**
   * Get current date/time context
   */
  private getCurrentDateTimeContext(): ChatMessage[] {
    return [
      {
        role: 'user',
        content: [createTextContent(`The current date is ${new Date().toString()}.`)],
        contextType: 'currentDate',
      },
    ];
  }

  /**
   * Get detailed context for the current sheet WITH cell values.
   * This is the rich context that the main agent doesn't get.
   */
  private async getCurrentSheetContext(): Promise<ChatMessage[]> {
    if (!fileHasData()) {
      return [
        {
          role: 'user',
          content: [createTextContent(`The current sheet is empty.`)],
          contextType: 'fileSummary',
        },
      ];
    }

    const currentSheet = sheets.sheet;
    const selection = sheets.stringToSelection('*', currentSheet.id).save();

    const sheetContexts = await quadraticCore.getAISelectionContexts({
      selections: [selection],
      maxRows: MAX_ROWS,
    });

    if (!sheetContexts || sheetContexts.length === 0) {
      return [
        {
          role: 'user',
          content: [createTextContent('Failed to get current sheet context.')],
          contextType: 'fileSummary',
        },
      ];
    }

    const sheetContext = sheetContexts[0];
    let text = `# Current Sheet: '${currentSheet.name}'

- Bounds: ${sheets.getAISheetBounds(currentSheet.name)}
- Default column width: ${sheetContext.default_column_width}px, default row height: ${sheetContext.default_row_height}px
`;

    // Data Tables with cell values
    if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
      text += `\n## Data Tables\n`;
      for (const table of sheetContext.data_tables) {
        text += `\n### ${table.data_table_name}\n`;
        text += `Located at ${table.bounds}\n`;
        if (table.values) {
          text += getAICellSummaryToMarkdown(table.data_table_name, table.values);
        }
      }
    }

    // Code Tables with cell values
    if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
      text += `\n## Code Tables\n`;
      for (const table of sheetContext.code_tables) {
        text += `\n### ${table.code_table_name}\n`;
        text += `${table.language} table at ${table.bounds}\n`;
        if (table.values) {
          text += getAICellSummaryToMarkdown(table.code_table_name, table.values);
        }
      }
    }

    // Connection Tables with cell values
    if (sheetContext.connections && sheetContext.connections.length > 0) {
      text += `\n## Connection Tables\n`;
      for (const table of sheetContext.connections) {
        if (typeof table.language !== 'object' || !table.language.Connection) {
          continue;
        }
        text += `\n### ${table.code_table_name}\n`;
        text += `${table.language.Connection.kind} connection at ${table.bounds}\n`;
        if (table.values) {
          text += getAICellSummaryToMarkdown(table.code_table_name, table.values);
        }
      }
    }

    // Charts
    if (sheetContext.charts && sheetContext.charts.length > 0) {
      text += `\n## Charts\n`;
      for (const chart of sheetContext.charts) {
        text += `- '${chart.chart_name}' (${chart.language}) at ${chart.bounds}\n`;
      }
    }

    // Flat Data with cell values
    if (sheetContext.data_rects && sheetContext.data_rects.length > 0) {
      text += `\n## Flat Data (limited to ${MAX_ROWS} rows)\n`;
      for (const data of sheetContext.data_rects) {
        text += getAICellSummaryToMarkdown(data.total_range, data);
      }
    }

    return [
      {
        role: 'user',
        content: [createTextContent(text)],
        contextType: 'fileSummary',
      },
    ];
  }

  /**
   * Get overview of other sheets (names and bounds only, no cell values).
   * Subagent can use get_sheet_data tool to load details for specific sheets.
   */
  private async getOtherSheetsOverview(): Promise<ChatMessage[]> {
    const currentSheetId = sheets.current;
    const otherSheets = sheets.sheets.filter((s) => s.id !== currentSheetId);

    if (otherSheets.length === 0) {
      return [];
    }

    const selections = otherSheets.map((sheet) => sheets.stringToSelection('*', sheet.id).save());

    const sheetContexts = await quadraticCore.getAISelectionContexts({
      selections,
      maxRows: 0, // Don't fetch row data for other sheets
    });

    if (!sheetContexts) {
      return [];
    }

    let text = `# Other Sheets

The following sheets exist but you only have their structure, not their data.
Use get_cell_data with the sheet_name parameter to explore data in these sheets.

`;

    for (const sheetContext of sheetContexts) {
      text += `## '${sheetContext.sheet_name}'\n`;
      text += `- Bounds: ${sheets.getAISheetBounds(sheetContext.sheet_name)}\n`;

      const tableCount =
        (sheetContext.data_tables?.length ?? 0) +
        (sheetContext.code_tables?.length ?? 0) +
        (sheetContext.connections?.length ?? 0);

      if (tableCount > 0) {
        text += `- Tables: `;
        const parts = [];
        if (sheetContext.data_tables?.length) {
          parts.push(`${sheetContext.data_tables.length} data ${pluralize('table', sheetContext.data_tables.length)}`);
        }
        if (sheetContext.code_tables?.length) {
          parts.push(`${sheetContext.code_tables.length} code ${pluralize('table', sheetContext.code_tables.length)}`);
        }
        if (sheetContext.connections?.length) {
          parts.push(
            `${sheetContext.connections.length} connection ${pluralize('table', sheetContext.connections.length)}`
          );
        }
        text += parts.join(', ') + '\n';

        // List table names without data
        if (sheetContext.data_tables?.length) {
          for (const table of sheetContext.data_tables) {
            text += `  - Data table '${table.data_table_name}' at ${table.bounds}\n`;
          }
        }
        if (sheetContext.code_tables?.length) {
          for (const table of sheetContext.code_tables) {
            text += `  - Code table '${table.code_table_name}' (${table.language}) at ${table.bounds}\n`;
          }
        }
      }

      if (sheetContext.charts?.length) {
        text += `- Charts: ${sheetContext.charts.length}\n`;
      }

      text += '\n';
    }

    return [
      {
        role: 'user',
        content: [createTextContent(text)],
        contextType: 'otherSheets',
      },
    ];
  }

  /**
   * Create the task message for the subagent.
   */
  private getTaskMessage(task: string, contextHints?: string): ChatMessage {
    let text = `# Your Task

${task}`;

    if (contextHints) {
      text += `

## Additional Context
${contextHints}`;
    }

    return {
      role: 'user',
      content: [createTextContent(text)],
      contextType: 'userPrompt',
    };
  }

  /**
   * Get detailed context for a specific sheet (used by get_sheet_data tool).
   * Returns full cell values for the requested sheet.
   */
  async getSheetDataContext(sheetName: string): Promise<string> {
    const sheet = sheets.getSheetByName(sheetName);
    if (!sheet) {
      return `Error: Sheet '${sheetName}' not found.`;
    }

    const selection = sheets.stringToSelection('*', sheet.id).save();
    const sheetContexts = await quadraticCore.getAISelectionContexts({
      selections: [selection],
      maxRows: MAX_ROWS,
    });

    if (!sheetContexts || sheetContexts.length === 0) {
      return `Error: Failed to get context for sheet '${sheetName}'.`;
    }

    const sheetContext = sheetContexts[0];
    let text = `# Sheet: '${sheetName}'

- Bounds: ${sheets.getAISheetBounds(sheetName)}
`;

    // Data Tables with cell values
    if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
      text += `\n## Data Tables\n`;
      for (const table of sheetContext.data_tables) {
        text += `\n### ${table.data_table_name}\n`;
        text += `Located at ${table.bounds}\n`;
        if (table.values) {
          text += getAICellSummaryToMarkdown(table.data_table_name, table.values);
        }
      }
    }

    // Code Tables with cell values
    if (sheetContext.code_tables && sheetContext.code_tables.length > 0) {
      text += `\n## Code Tables\n`;
      for (const table of sheetContext.code_tables) {
        text += `\n### ${table.code_table_name}\n`;
        text += `${table.language} table at ${table.bounds}\n`;
        if (table.values) {
          text += getAICellSummaryToMarkdown(table.code_table_name, table.values);
        }
      }
    }

    // Flat Data with cell values
    if (sheetContext.data_rects && sheetContext.data_rects.length > 0) {
      text += `\n## Flat Data (limited to ${MAX_ROWS} rows)\n`;
      for (const data of sheetContext.data_rects) {
        text += getAICellSummaryToMarkdown(data.total_range, data);
      }
    }

    return text;
  }
}

// Singleton instance
export const subagentContextBuilder = new SubagentContextBuilder();
