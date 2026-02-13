import type { TrackedOperation, TrackedTransaction } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

const MAX_TRANSACTIONS = 20;

type OperationMessageMap<T extends { type: string }> = {
  [K in T['type']]: (operation: Extract<T, { type: K }>) => string;
};
const OperationToChatMessage: OperationMessageMap<TrackedOperation> = {
  SetCellValues: (operation) => `- set or delete values in the range of ${operation.selection}`,
  AddSheet: (operation) => `- added sheet ${operation.sheet_name}`,
  DeleteSheet: (operation) => `- deleted sheet ${operation.sheet_name}`,
  DuplicateSheet: (operation) => `- duplicated sheet ${operation.sheet_name} to ${operation.duplicated_sheet_name}`,
  SetSheetName: (operation) => `- renamed sheet ${operation.old_sheet_name} to '${operation.new_sheet_name}'`,
  SetSheetColor: (operation) => `- set sheet ${operation.sheet_name} color to ${operation.color ?? 'default'}`,
  ReorderSheet: (operation) => `- reordered sheet ${operation.sheet_name} to order ${operation.order}`,
  ReplaceSheet: (operation) => `- replaced sheet ${operation.sheet_name} with a new one on import from Excel file`,
  SetDataTable: (operation) =>
    `- ${operation.deleted ? 'deleted' : 'set'} data table at ${operation.selection}${operation.name ? ` named '${operation.name}'` : ''}`,
  DeleteDataTable: (operation) => `- deleted data table at ${operation.selection}`,
  FlattenDataTable: (operation) => `- flattened data table at ${operation.selection}`, // Note: removed transaction.source reference
  GridToDataTable: (operation) => `- converted grid to data table at ${operation.selection}`,
  DataTableColumnsChanged: (operation) => `- changed data table columns at ${operation.selection}`,
  DataTableRowsChanged: (operation) => `- changed data table rows at ${operation.selection}`,
  DataTableSorted: (operation) => `- sorted data table at ${operation.selection}`,
  DataTableHeaderToggled: (operation) =>
    `- ${operation.first_row_is_header ? 'enabled' : 'disabled'} first row as header at ${operation.selection}`,
  FormatsChanged: (operation) => `- changed formats in sheet ${operation.sheet_name} at ${operation.selection}`,
  ResizeColumn: (operation) =>
    `- resized column ${operation.column} in sheet ${operation.sheet_name} to ${operation.new_size}`,
  ResizeRow: (operation) => `- resized row ${operation.row} in sheet ${operation.sheet_name} to ${operation.new_size}`,
  ColumnsResized: (operation) => `- resized ${operation.count} columns in sheet ${operation.sheet_name}`,
  RowsResized: (operation) => `- resized ${operation.count} rows in sheet ${operation.sheet_name}`,
  DefaultRowSize: (operation) => `- set default row size to ${operation.size} in sheet ${operation.sheet_name}`,
  DefaultColumnSize: (operation) => `- set default column size to ${operation.size} in sheet ${operation.sheet_name}`,
  CursorChanged: (operation) => `- moved cursor to ${operation.selection}`,
  MoveCells: (operation) => `- moved cells from ${operation.from} to ${operation.to}`,
  ValidationSet: (operation) => `- set validation rules at ${operation.selection}`,
  ValidationRemoved: (operation) =>
    `- removed validation rule ${operation.validation_id} in sheet ${operation.sheet_name}`,
  ValidationRemovedSelection: (operation) =>
    `- removed validation rules at ${operation.selection} in sheet ${operation.sheet_name}`,
  ConditionalFormatSet: (operation) => `- set conditional format at ${operation.selection}`,
  ConditionalFormatRemoved: (operation) =>
    `- removed conditional format ${operation.conditional_format_id} in sheet ${operation.sheet_name}`,
  ColumnInserted: (operation) => `- inserted column at ${operation.column} in sheet ${operation.sheet_name}`,
  ColumnDeleted: (operation) => `- deleted column at ${operation.column} in sheet ${operation.sheet_name}`,
  RowInserted: (operation) => `- inserted row at ${operation.row} in sheet ${operation.sheet_name}`,
  RowDeleted: (operation) => `- deleted row at ${operation.row} in sheet ${operation.sheet_name}`,
  ColumnsDeleted: (operation) => `- deleted columns ${operation.columns.join(', ')} in sheet ${operation.sheet_name}`,
  RowsDeleted: (operation) => `- deleted rows ${operation.rows.join(', ')} in sheet ${operation.sheet_name}`,
  ColumnsMoved: (operation) =>
    `- moved columns ${operation.from_range[0]}-${operation.from_range[1]} to ${operation.to} in sheet ${operation.sheet_name}`,
  RowsMoved: (operation) =>
    `- moved rows ${operation.from_range[0]}-${operation.from_range[1]} to ${operation.to} in sheet ${operation.sheet_name}`,
  ComputeCode: (operation) => `- computed code at ${operation.selection}`,
  MoveDataTable: (operation) => `- moved data table from ${operation.from} to ${operation.to}`,
  SwitchDataTableKind: (operation) => `- switched data table at ${operation.selection} to ${operation.kind}`,
  SetMergeCells: (operation) => `- set merge cells at ${operation.sheet_name}`,
};

const convertTransactionToChatMessage = (transaction: TrackedTransaction): string => {
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
  ${transaction.operations.map((operation) => OperationToChatMessage[operation.type](operation as any)).join('\n')}`;
};

export const useAITransactions = () => {
  const getAITransactions = useCallback(async (): Promise<ChatMessage[]> => {
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
  ?.slice(-MAX_TRANSACTIONS)
  .map((transaction) => `${convertTransactionToChatMessage(transaction)}`)
  .join('\n')}

${transactions?.length > MAX_TRANSACTIONS ? `The list of transactions has been truncated to the latest ${MAX_TRANSACTIONS} transactions.` : ''}`),
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

  return { getAITransactions };
};
