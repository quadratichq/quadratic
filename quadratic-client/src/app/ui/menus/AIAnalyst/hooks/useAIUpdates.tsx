import { aiAnalystCurrentChatAtom } from '@/app/atoms/aiAnalystAtom';
import { events } from '@/app/events/events';
import type { AIOperation, JsAITransactions, TransactionSource } from '@/app/quadratic-core-types';
import type { ChatMessage, TextContent } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

const source = (source: TransactionSource): string => {
  switch (source) {
    case 'User':
      return 'the user making changes. This adds these actions to the undo stacks';
    case 'Multiplayer':
      return 'another user making changes';
    case 'Redo':
      return 'a redo action, which will change the undo and redo stacks';
    case 'Undo':
      return 'an undo action, which will change the undo and redo stacks';
    default:
      return 'an unknown source';
  }
};

const translateOp = (op: AIOperation): string => {
  switch (op.type) {
    case 'SetCellValues':
      return `The cell values in range ${op.selection} have been changed.`;
    case 'SetDataTable':
      return `The data table anchored at ${op.sheet_pos} has been changed. You can find more information about this change in the data table context above.`;
    case 'DeleteDataTable':
      return `The data table anchored at ${op.sheet_pos} has been deleted.`;
    case 'FlattenDataTable':
      return `The data table anchored at ${op.sheet_pos} has been flattened. All of its data has been moved to the grid.`;
    case 'GridToDataTable':
      return `Convert grid to data table at ${op.sheet_rect}.`;
    case 'DataTableColumnsChanged':
      return `Change data table columns in range ${op.sheet_pos}.`;
    case 'DataTableRowsChanged':
      return ``;
    case 'DataTableSorted':
      return ``;
    case 'DataTableHeaderToggled':
      return ``;
    case 'ComputeCode':
      return ``;
    case 'FormatsChanged':
      return ``;
    case 'AddSheet':
      return ``;
    case 'DeleteSheet':
      return ``;
    case 'DuplicateSheet':
      return ``;
    case 'SetSheetName':
      return ``;
    case 'SetSheetColor':
      return ``;
    case 'ReorderSheet':
      return ``;
    case 'ResizeColumn':
      return ``;
    case 'ResizeRow':
      return ``;
    case 'ColumnsResized':
      return ``;
    case 'RowsResized':
      return ``;
    case 'DefaultRowSize':
      return ``;
    case 'DefaultColumnSize':
      return ``;
    case 'CursorChanged':
      return ``;
    case 'MoveCells':
      return ``;
    case 'ValidationSet':
      return ``;
    case 'ValidationRemoved':
      return ``;
    case 'ColumnInserted':
      return ``;
    case 'RowInserted':
      return ``;
    case 'RowDeleted':
      return ``;
    case 'ColumnsDeleted':
      return ``;
    case 'RowsDeleted':
      return ``;
    case 'ColumnsMoved':
      return ``;
    case 'RowsMoved':
      return ``;
  }
  return 'Unknown operation';
};

export const convertAIUpdatesToChatMessage = (updates: JsAITransactions): ChatMessage => {
  const content: TextContent[] = [];
  const addText = (text: string) => content.push({ type: 'text', text });

  addText(
    `While this chat was active, we received the following updates from ${source(updates.source)}. The following are the changes:`
  );

  for (const op of updates.ops) {
    addText(translateOp(op));
  }

  return {
    role: 'user',
    content,
    contextType: 'aiUpdates',
  };
};

export const useAIUpdates = () => {
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);

  useEffect(() => {
    const handleAIUpdates = (updates: JsAITransactions) => {
      setCurrentChat((prev) => {
        // We don't need to update the AI chat if it's currently empty. (The
        // updates are only interesting if the user has already started a chat.)
        if (prev.messages.length === 0) {
          return prev;
        }
        const messages = {
          ...prev,
          messages: [...prev.messages, convertAIUpdatesToChatMessage(updates)],
        };
        console.log(messages);
        return messages;
      });
    };
    events.on('aiUpdates', handleAIUpdates);
    return () => {
      events.off('aiUpdates', handleAIUpdates);
    };
  }, [setCurrentChat]);
};
