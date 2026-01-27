import { MAX_ROWS } from '@/app/ai/constants/context';
import { getAICellSummaryToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { getConnectionMarkdown, getConnectionTableInfo } from '@/app/ai/utils/aiConnectionContext';
import { sheets } from '@/app/grid/controller/Sheets';
import { getRectSelection } from '@/app/grid/sheet/selection';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { translateLanguageForAI } from '@/app/helpers/codeCellLanguage';
import { pluralize } from '@/app/helpers/pluralize';
import type { JsCodeErrorContext, TrackedOperation, TrackedTransaction } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { joinListWith } from '@/shared/components/JointListWith';
import { FAILING_SQL_CONNECTIONS_EXPIRATION_TIME } from '@/shared/constants/connectionsConstant';
import {
  createTextContent,
  filterImageFilesInChatMessages,
  filterPdfFilesInChatMessages,
  getPromptAndInternalMessages,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage, Context } from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';
import { aiStore, failingSqlConnectionsAtom } from '../atoms/aiAnalystAtoms';
import type { ContextOptions } from './types';

const MAX_ERRORS_PER_SHEET = 10;
const MAX_TRANSACTIONS = 20;

/**
 * ContextBuilder builds AI context from various sources.
 * This is a pure class with no React dependencies.
 */
export class ContextBuilder {
  private store = aiStore;
  private teamUuid: string | undefined;

  /**
   * Set the team UUID for connection context
   */
  setTeamUuid(teamUuid: string | undefined): void {
    this.teamUuid = teamUuid;
  }

  /**
   * Build complete context for an AI request
   */
  async buildContext(options: ContextOptions): Promise<ChatMessage[]> {
    const [sqlContext, filesContext, visibleContext, summaryContext, codeErrorContext, aiTransactions] =
      await Promise.all([
        this.getSqlContext(options.connections, options.context),
        this.getFilesContext(options.chatMessages),
        this.getVisibleContext(),
        this.getSummaryContext(),
        this.getCodeErrorContext(),
        this.getAITransactions(),
      ]);

    const messagesWithContext: ChatMessage[] = [
      ...sqlContext,
      ...filesContext,
      ...this.getCurrentDateTimeContext(),
      ...aiTransactions,
      ...visibleContext,
      ...summaryContext,
      ...codeErrorContext,
      ...getPromptAndInternalMessages(options.chatMessages),
    ];

    return messagesWithContext;
  }

  /**
   * Get SQL/database connection context
   */
  async getSqlContext(connections: ConnectionList, context: Context): Promise<ChatMessage[]> {
    try {
      if (!this.teamUuid) {
        console.warn('[ContextBuilder] No team UUID available');
        return [];
      }

      if (!connections || connections.length === 0) {
        return [];
      }

      let failingSqlConnections = this.store.get(failingSqlConnectionsAtom);
      const currentTime = Date.now();

      if (currentTime - failingSqlConnections.lastResetTimestamp > FAILING_SQL_CONNECTIONS_EXPIRATION_TIME) {
        failingSqlConnections = { uuids: [], lastResetTimestamp: currentTime };
        this.store.set(failingSqlConnectionsAtom, failingSqlConnections);
      }

      let contextText = '';
      await Promise.all(
        connections
          .filter((conn) => !context.connection || context.connection.id === conn.uuid)
          .map(async (connection) => {
            try {
              if (failingSqlConnections.uuids.includes(connection.uuid)) {
                return;
              }

              const connectionTableInfo = await getConnectionTableInfo(connection, this.teamUuid!);
              contextText += getConnectionMarkdown(connectionTableInfo);
            } catch (error) {
              this.store.set(failingSqlConnectionsAtom, (prev) => ({
                ...prev,
                uuids: [...prev.uuids.filter((uuid) => uuid !== connection.uuid), connection.uuid],
              }));

              console.warn(`[ContextBuilder] Failed to get table names for connection ${connection.uuid}:`, error);
            }
          })
      );

      if (!context.connection && !contextText) {
        return [];
      }

      return [
        {
          role: 'user',
          content: [
            createTextContent(`# Database Connections

This is the available Database Connections. This shows only table names within each connection.

Use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing.

${contextText}`),
          ],
          contextType: 'sqlSchemas',
        },
        {
          role: 'assistant',
          content: [
            createTextContent(
              `I understand the available database connections and tables. I will use the get_database_schemas tool to retrieve detailed column information, data types, and constraints when needed for SQL query writing. How can I help you?`
            ),
          ],
          contextType: 'sqlSchemas',
        },
      ];
    } catch (error) {
      console.error('[ContextBuilder] Error fetching SQL context:', error);
      return [];
    }
  }

  /**
   * Get files context (images, PDFs)
   */
  async getFilesContext(chatMessages: ChatMessage[]): Promise<ChatMessage[]> {
    const imageFiles = filterImageFilesInChatMessages(chatMessages);
    const pdfFiles = filterPdfFilesInChatMessages(chatMessages);

    return [
      {
        role: 'user',
        content: [
          createTextContent(
            `Note: This is an internal message for context. Do not quote it in your response.\n\n
${
  imageFiles.length === 0 && pdfFiles.length === 0
    ? `No files are attached. Don't use pdf import tool. Also do not assume or make any assumptions that files are attached when responding to users. If asked to do anything with attached files, ask for the file first since there are currently no files in context.`
    : ''
}
${
  imageFiles.length > 0
    ? `
I am sharing these image files, for your reference:\n
Images: ${imageFiles.map((file) => file.fileName).join(', ')}
`
    : ''
}\n
${
  pdfFiles.length > 0
    ? `
Also, I have the following pdf files available which you can use for extracting data. Use pdf_import tool for extracting data from these PDFs.\n
PDFs: ${pdfFiles.map((file) => file.fileName).join(', ')}\n
Use pdf files when prompted by calling the pdf_import for extracting data. Any related mention to the file should result in calling the pdf_import tool.\n
`
    : ''
}\n
Use these attached files as context to answer my questions.`
          ),
        ],
        contextType: 'files',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the files context,
${imageFiles.length > 0 ? `I will use the attached images as context to answer your questions.` : ''}\n
${pdfFiles.length > 0 ? `When prompted, I will use pdf_import tool to extract data from the attached pdf files.` : ''}\n
I will reference it to answer the following messages.\n
How can I help you?`
          ),
        ],
        contextType: 'files',
      },
    ];
  }

  /**
   * Get current date/time context
   */
  getCurrentDateTimeContext(): ChatMessage[] {
    return [
      {
        role: 'user',
        content: [createTextContent(`The current date is ${new Date().toString()}.`)],
        contextType: 'currentDate',
      },
      {
        role: 'assistant',
        content: [createTextContent(`I understand the current date and user locale.`)],
        contextType: 'currentDate',
      },
    ];
  }

  /**
   * Get visible area context
   */
  async getVisibleContext(): Promise<ChatMessage[]> {
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
            console.warn('Unexpected non-connection table in getVisibleContext');
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
  }

  /**
   * Get file summary context
   */
  async getSummaryContext(): Promise<ChatMessage[]> {
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
      maxRows: MAX_ROWS,
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

      // Data Tables
      if (sheetContext.data_tables && sheetContext.data_tables.length > 0) {
        text += `
### '${sheetContext.sheet_name}' Data tables:
    `;
        for (const table of sheetContext.data_tables) {
          text += `
#### ${table.data_table_name}

'${table.data_table_name}' has bounds of (${table.bounds}).
`;
          if (table.values) {
            text += getAICellSummaryToMarkdown(table.data_table_name, table.values);
          }
        }
      }

      // Code Tables
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
          if (table.values) {
            text += getAICellSummaryToMarkdown(table.code_table_name, table.values);
          }
        }
      }

      // Connection Tables
      if (sheetContext.connections && sheetContext.connections.length > 0) {
        text += `
### '${sheet.name}' Connection tables

These are the connection tables on the sheet:
`;
        for (const table of sheetContext.connections) {
          if (typeof table.language !== 'object' || !table.language.Connection) {
            console.warn('Unexpected non-connection table in getSummaryContext');
            continue;
          }
          text += `
#### ${table.code_table_name}

'${table.code_table_name}' is a connection table of type ${table.language.Connection.kind} with bounds of ${table.bounds}.
`;
          if (table.values) {
            text += getAICellSummaryToMarkdown(table.code_table_name, table.values);
          }
        }
      }

      // Charts
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
          text += getAICellSummaryToMarkdown(data.total_range, data);
        }
      }
      text += `\n`;
    }

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
            `I understand the file structure summary. If asked to solve a data problem, I will check this context, and if I'm missing data, use get_cell_data tool to view more data in my current sheet. Then I will use the appropriate cell references to access the data and write code and formulas to solve the problem. I will search the web if needed and make full appropriate use of my tools as needed to solve problems. How can I help you?`
          ),
        ],
        contextType: 'fileSummary',
      },
    ];
  }

  /**
   * Get code error context
   */
  async getCodeErrorContext(): Promise<ChatMessage[]> {
    const errors = await quadraticCore.getAICodeErrors(MAX_ERRORS_PER_SHEET);

    let errorText = `
# Code and Connection Errors
`;

    if (!errors) {
      errorText += `
There are no errors or spills in the file.`;
    } else {
      const currentSheetName = sheets.sheet.name;
      if (currentSheetName && errors.has(currentSheetName)) {
        errorText += this.translateError(currentSheetName, errors.get(currentSheetName) ?? [], true);
      }

      const sheetNames = Array.from(errors.keys()).filter((sheetName) => sheetName !== currentSheetName);
      for (const sheetName of sheetNames) {
        errorText += this.translateError(sheetName, errors.get(sheetName) ?? [], false);
      }
    }

    return [
      {
        role: 'user',
        content: [createTextContent(errorText)],
        contextType: 'codeErrors',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the code errors in code cells in the sheets, I will reference it to answer messages related to fixing code errors or spill errors.`
          ),
        ],
        contextType: 'codeErrors',
      },
    ];
  }

  /**
   * Get AI transactions context
   */
  async getAITransactions(): Promise<ChatMessage[]> {
    const transactions = await quadraticCore.getAITransactions();
    if (!transactions) {
      console.error('Failed to get transactions.');
      return [];
    }

    return [
      {
        role: 'user',
        content: [
          createTextContent(`
The following is a list of transactions that have occurred since the file was opened. This list may be truncated, but the latest transactions are always included.
The transactions are ordered from oldest to newest.
Transactions that are marked undoable may be called with the undo tool call. Transactions that are marked redoable may be called with the redo tool call.
Undo and redo work on the latest available transaction first, and follow the normal undo/redo logic.
Undo and redo works across the file. That is, each sheet does not have its own undo or redo stack.

${transactions
  .slice(-MAX_TRANSACTIONS)
  .map((transaction) => this.convertTransactionToChatMessage(transaction))
  .join('\n')}

${transactions.length > MAX_TRANSACTIONS ? `The list of transactions has been truncated to the latest ${MAX_TRANSACTIONS} transactions.` : ''}`),
        ],
        contextType: 'aiUpdates',
      },
      {
        role: 'assistant',
        content: [
          createTextContent(
            `I understand the latest transaction updates, I will reference it to answer questions about undo, redo, or what the user or other players have done on the sheet.`
          ),
        ],
        contextType: 'aiUpdates',
      },
    ];
  }

  // Private helpers

  private translateError(sheetName: string, errors: JsCodeErrorContext[], isCurrentSheet: boolean): string {
    let text = `
## ${sheetName}
`;

    if (isCurrentSheet) {
      text += `
This is the user's current sheet.
`;
    }

    const codeErrors = errors.filter((error) => error.error && !error.is_spill && typeof error.language === 'string');
    const connectionErrors = errors.filter(
      (error) => !error.error && !error.is_spill && typeof error.language !== 'string'
    );
    const spills = errors.filter((error) => error.is_spill);

    if (codeErrors.length > 0) {
      text += `
### Code Errors
`;
      for (const error of codeErrors) {
        text += `
- ${error.name} at ${error.pos} is a ${error.language} cell with the following error: "${error.error}".`;
      }
      text += '\n';
    }

    if (connectionErrors.length > 0) {
      text += `
### Connection Errors
`;
      for (const error of connectionErrors) {
        if (typeof error.language !== 'object') continue;
        text += `
- ${error.name} at ${error.pos} is ${translateLanguageForAI(error.language)} with the following error: "${error.error}".`;
      }
      text += '\n';
    }

    if (spills.length > 0) {
      text += `
### Spills
`;
      for (const spill of spills) {
        text += `
- ${spill.name} at ${spill.pos} is a ${translateLanguageForAI(spill.language)} cell that has spilled its content. It's expected to be in the following range: "${spill.expected_bounds}".`;
      }
      text += '\n';
    }

    return text;
  }

  private convertTransactionToChatMessage(transaction: TrackedTransaction): string {
    const undoable =
      transaction.source === 'User' ||
      transaction.source === 'AI' ||
      transaction.source === 'Redo' ||
      transaction.source === 'RedoAI'
        ? 'undoable'
        : transaction.source === 'Undo' || transaction.source === 'UndoAI'
          ? 'redoable'
          : '';

    return `- ${transaction.source} transaction${undoable ? ` marked as ${undoable}` : ''}. The following was executed:
  ${transaction.operations.map((operation) => this.operationToMessage(operation)).join('\n')}`;
  }

  private operationToMessage(operation: TrackedOperation): string {
    const messageMap: Record<string, (op: TrackedOperation) => string> = {
      SetCellValues: (op) => `- set or delete values in the range of ${(op as any).selection}`,
      AddSheet: (op) => `- added sheet ${(op as any).sheet_name}`,
      DeleteSheet: (op) => `- deleted sheet ${(op as any).sheet_name}`,
      DuplicateSheet: (op) => `- duplicated sheet ${(op as any).sheet_name} to ${(op as any).duplicated_sheet_name}`,
      SetSheetName: (op) => `- renamed sheet ${(op as any).old_sheet_name} to '${(op as any).new_sheet_name}'`,
      SetSheetColor: (op) => `- set sheet ${(op as any).sheet_name} color to ${(op as any).color ?? 'default'}`,
      ReorderSheet: (op) => `- reordered sheet ${(op as any).sheet_name} to order ${(op as any).order}`,
      ReplaceSheet: (op) => `- replaced sheet ${(op as any).sheet_name} with a new one on import from Excel file`,
      SetDataTable: (op) =>
        `- ${(op as any).deleted ? 'deleted' : 'set'} data table at ${(op as any).selection}${(op as any).name ? ` named '${(op as any).name}'` : ''}`,
      DeleteDataTable: (op) => `- deleted data table at ${(op as any).selection}`,
      FlattenDataTable: (op) => `- flattened data table at ${(op as any).selection}`,
      GridToDataTable: (op) => `- converted grid to data table at ${(op as any).selection}`,
      DataTableColumnsChanged: (op) => `- changed data table columns at ${(op as any).selection}`,
      DataTableRowsChanged: (op) => `- changed data table rows at ${(op as any).selection}`,
      DataTableSorted: (op) => `- sorted data table at ${(op as any).selection}`,
      DataTableHeaderToggled: (op) =>
        `- ${(op as any).first_row_is_header ? 'enabled' : 'disabled'} first row as header at ${(op as any).selection}`,
      FormatsChanged: (op) => `- changed formats in sheet ${(op as any).sheet_name} at ${(op as any).selection}`,
      ResizeColumn: (op) =>
        `- resized column ${(op as any).column} in sheet ${(op as any).sheet_name} to ${(op as any).new_size}`,
      ResizeRow: (op) =>
        `- resized row ${(op as any).row} in sheet ${(op as any).sheet_name} to ${(op as any).new_size}`,
      ColumnsResized: (op) => `- resized ${(op as any).count} columns in sheet ${(op as any).sheet_name}`,
      RowsResized: (op) => `- resized ${(op as any).count} rows in sheet ${(op as any).sheet_name}`,
      DefaultRowSize: (op) => `- set default row size to ${(op as any).size} in sheet ${(op as any).sheet_name}`,
      DefaultColumnSize: (op) => `- set default column size to ${(op as any).size} in sheet ${(op as any).sheet_name}`,
      CursorChanged: (op) => `- moved cursor to ${(op as any).selection}`,
      MoveCells: (op) => `- moved cells from ${(op as any).from} to ${(op as any).to}`,
      ValidationSet: (op) => `- set validation rules at ${(op as any).selection}`,
      ValidationRemoved: (op) =>
        `- removed validation rule ${(op as any).validation_id} in sheet ${(op as any).sheet_name}`,
      ValidationRemovedSelection: (op) =>
        `- removed validation rules at ${(op as any).selection} in sheet ${(op as any).sheet_name}`,
      ConditionalFormatSet: (op) => `- set conditional format at ${(op as any).selection}`,
      ConditionalFormatRemoved: (op) =>
        `- removed conditional format ${(op as any).conditional_format_id} in sheet ${(op as any).sheet_name}`,
      ColumnInserted: (op) => `- inserted column at ${(op as any).column} in sheet ${(op as any).sheet_name}`,
      ColumnDeleted: (op) => `- deleted column at ${(op as any).column} in sheet ${(op as any).sheet_name}`,
      RowInserted: (op) => `- inserted row at ${(op as any).row} in sheet ${(op as any).sheet_name}`,
      RowDeleted: (op) => `- deleted row at ${(op as any).row} in sheet ${(op as any).sheet_name}`,
      ColumnsDeleted: (op) => `- deleted columns ${(op as any).columns.join(', ')} in sheet ${(op as any).sheet_name}`,
      RowsDeleted: (op) => `- deleted rows ${(op as any).rows.join(', ')} in sheet ${(op as any).sheet_name}`,
      ColumnsMoved: (op) =>
        `- moved columns ${(op as any).from_range[0]}-${(op as any).from_range[1]} to ${(op as any).to} in sheet ${(op as any).sheet_name}`,
      RowsMoved: (op) =>
        `- moved rows ${(op as any).from_range[0]}-${(op as any).from_range[1]} to ${(op as any).to} in sheet ${(op as any).sheet_name}`,
      ComputeCode: (op) => `- computed code at ${(op as any).selection}`,
      MoveDataTable: (op) => `- moved data table from ${(op as any).from} to ${(op as any).to}`,
      SwitchDataTableKind: (op) => `- switched data table at ${(op as any).selection} to ${(op as any).kind}`,
      SetMergeCells: (op) => `- set merge cells at ${(op as any).sheet_name}`,
    };

    const handler = messageMap[operation.type];
    return handler ? handler(operation) : `- unknown operation: ${operation.type}`;
  }
}

// Singleton instance for easy access
export const contextBuilder = new ContextBuilder();
