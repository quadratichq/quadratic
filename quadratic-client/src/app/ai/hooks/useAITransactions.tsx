import { sheets } from '@/app/grid/controller/Sheets';
import type { TrackedTransaction } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

const sheetIdToName = (sheetId: string): string => {
  const sheet = sheets.getById(sheetId);
  if (sheet) {
    return `'${sheet.name}'`;
  }
  return '[This sheet no longer exists]';
};

const convertTransactionToChatMessage = (transaction: TrackedTransaction): string => {
  const undoable = transaction.source === 'User' ? 'undoable' : transaction.source === 'Undo' ? 'redoable' : '';
  return `- ${transaction.source} transaction${undoable ? ` marked as ${undoable}` : ''}. The following was executed:
  ${transaction.operations
    .map((operation) => {
      switch (operation.type) {
        case 'SetCellValues':
          return `- set or delete values in the range of ${operation.selection}`;
        case 'AddSheet':
          return `- added sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'DeleteSheet':
          return `- deleted sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'DuplicateSheet':
          return `- duplicated sheet ${sheetIdToName(operation.sheet_id)} to ${sheetIdToName(operation.new_sheet_id)}`;
        case 'SetSheetName':
          return `- renamed sheet ${sheetIdToName(operation.sheet_id)} to '${operation.name}'`;
        case 'SetSheetColor':
          return `- set sheet ${sheetIdToName(operation.sheet_id)} color to ${operation.color ?? 'default'}`;
        case 'ReorderSheet':
          return `- reordered sheet ${sheetIdToName(operation.target.id)} to order ${operation.order}`;
        case 'SetDataTable':
          return `- ${operation.deleted ? 'deleted' : 'set'} data table at ${operation.selection}${operation.name ? ` named '${operation.name}'` : ''}`;
        case 'DeleteDataTable':
          return `- deleted data table at ${operation.selection}`;
        case 'FlattenDataTable':
          return `${transaction.source} flattened data table at ${operation.selection}`;
        case 'GridToDataTable':
          return `- converted grid to data table at ${operation.selection}`;
        case 'DataTableColumnsChanged':
          return `- changed data table columns at ${operation.selection}`;
        case 'DataTableRowsChanged':
          return `- changed data table rows at ${operation.selection}`;
        case 'DataTableSorted':
          return `- sorted data table at ${operation.selection}`;
        case 'DataTableHeaderToggled':
          return `- ${operation.first_row_is_header ? 'enabled' : 'disabled'} first row as header at ${operation.selection}`;
        case 'FormatsChanged':
          return `- changed formats in sheet ${sheetIdToName(operation.sheet_id)} at ${operation.selection}`;
        case 'ResizeColumn':
          return `- resized column ${operation.column} in sheet ${sheetIdToName(operation.sheet_id)} to ${operation.new_size}`;
        case 'ResizeRow':
          return `- resized row ${operation.row} in sheet ${sheetIdToName(operation.sheet_id)} to ${operation.new_size}`;
        case 'ColumnsResized':
          return `- resized ${operation.count} columns in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'RowsResized':
          return `- resized ${operation.count} rows in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'DefaultRowSize':
          return `- set default row size to ${operation.size} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'DefaultColumnSize':
          return `- set default column size to ${operation.size} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'CursorChanged':
          return `- moved cursor to ${operation.selection}`;
        case 'MoveCells':
          return `- moved cells from ${sheetIdToName(operation.from.sheet_id.id)} to ${sheetIdToName(operation.to.sheet_id.id)}`;
        case 'ValidationSet':
          return `- set validation rules at ${sheetIdToName(operation.validation.selection.sheet_id.id)}`;
        case 'ValidationRemoved':
          return `- removed validation rule ${operation.validation_id} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'ValidationRemovedSelection':
          return `- removed validation rules at ${operation.selection} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'ColumnInserted':
          return `- inserted column at ${operation.column} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'ColumnDeleted':
          return `- deleted column at ${operation.column} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'RowInserted':
          return `- inserted row at ${operation.row} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'RowDeleted':
          return `- deleted row at ${operation.row} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'ColumnsDeleted':
          return `- deleted columns ${operation.columns.join(', ')} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'RowsDeleted':
          return `- deleted rows ${operation.rows.join(', ')} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'ColumnsMoved':
          return `- moved columns ${operation.from_range[0]}-${operation.from_range[1]} to ${operation.to} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'RowsMoved':
          return `- moved rows ${operation.from_range[0]}-${operation.from_range[1]} to ${operation.to} in sheet ${sheetIdToName(operation.sheet_id)}`;
        case 'ComputeCode':
          return `- computed code at ${operation.selection}`;
        default:
          throw new Error(`Unknown operation type: ${JSON.stringify(operation)}`);
      }
    })
    .join('\n')}`;
};

export const useAITransactions = () => {
  const getAITransactions = useCallback(async (): Promise<ChatMessage[]> => {
    const transactions = await quadraticCore.getAITransactions();
    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
The following is a list of transactions that have occurred since the file was opened. This list may be truncated, but the latest transactions are always included.
The transactions are ordered from oldest to newest.
Transactions that are marked undoable may be called with the undo tool call. Transactions that are marked redoable may be called with the redo tool call.
Undo and redo work on the latest available transaction, and follow the normal undo/redo logic.
Undo and redo works across the file. That is, each sheet does not have its own undo or redo stack.

${transactions?.map((transaction) => `${convertTransactionToChatMessage(transaction)}`).join('\n')}`,
          },
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
  }, []);

  return {
    getAITransactions,
  };
};
