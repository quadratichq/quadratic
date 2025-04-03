import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { CodeCellLanguage, SheetRect } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { z } from 'zod';

export const waitForSetCodeCellValue = (transactionId: string) => {
  return new Promise<void>((resolve) => {
    const checkTransactionStatus = () => {
      const isRunning = pixiAppSettings.editorInteractionState.transactionsInfo.some(
        (t: { transactionId: string }) => t.transactionId === transactionId
      );
      if (!isRunning) {
        resolve();
      } else {
        events.once('transactionEnd', (transactionEnd) => {
          if (transactionEnd.transactionId === transactionId) {
            resolve();
          } else {
            waitForSetCodeCellValue(transactionId).then(resolve);
          }
        });
      }
    };
    checkTransactionStatus();
  });
};

const setCodeCellResult = async (sheetId: string, x: number, y: number): Promise<string> => {
  const table = pixiApp.cellsSheets.getById(sheetId)?.tables.getTableFromTableCell(x, y);
  const codeCell = await quadraticCore.getCodeCell(sheetId, x, y);
  if (!table || !codeCell) return 'Error executing set code cell value tool';

  if (codeCell.std_err) {
    return `
The code cell run has resulted in an error:
\`\`\`
${codeCell.std_err}
\`\`\`
Think and reason about the error and try to fix it.
`;
  }

  if (codeCell.spill_error) {
    return `
The code cell has spilled, because the output overlaps with existing data on the sheet at position:
\`\`\`json\n
${JSON.stringify(codeCell.spill_error?.map((p) => ({ x: Number(p.x), y: Number(p.y) })))}
\`\`\`
Output size is ${table.codeCell.w} cells wide and ${table.codeCell.h} cells high.
Move the code cell to a new position to avoid spilling. Make sure the new position is not overlapping with existing data on the sheet.
`;
  }

  return `
Executed set code cell value tool successfully.
${
  table.isSingleValue()
    ? `Output is ${codeCell.evaluation_result}`
    : `Output size is ${table.codeCell.w} cells wide and ${table.codeCell.h} cells high.`
}
`;
};

// Helper function to set code cell value and name in an optimized way
export const setCodeCellValueAndName = async (
  sheetId: string,
  x: number,
  y: number,
  codeString: string,
  language: CodeCellLanguage,
  cellName: string,
  cursor?: string
): Promise<string | undefined> => {
  try {
    // Create the code cell first
    const transactionId = await quadraticCore.setCodeCellValue({
      sheetId,
      x,
      y,
      codeString,
      language,
      cursor,
    });

    if (transactionId) {
      // Wait for the code cell to be fully created
      await waitForSetCodeCellValue(transactionId);

      // Then set the name
      await quadraticCore.dataTableMeta(
        sheetId,
        x,
        y,
        {
          name: cellName,
          showName: true,
        },
        cursor
      );
    }

    return transactionId;
  } catch (error) {
    console.error('Error in setCodeCellValueAndName:', error);
    return undefined;
  }
};

export type AIToolActionsRecord = {
  [K in AITool]: (args: z.infer<(typeof AIToolsArgsSchema)[K]>) => Promise<string>;
};

export const aiToolsActions: AIToolActionsRecord = {
  [AITool.SetChatName]: async (args) => {
    // no action as this tool is only meant to get structured data from AI
    return `Executed set chat name tool successfully with name: ${args.chat_name}`;
  },
  [AITool.AddDataTable]: async (args) => {
    const { top_left_position, table_name, table_data } = args;

    try {
      const selection = stringToSelection(top_left_position, sheets.current, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return 'Invalid code cell position, this should be a single cell, not a range';
      }
      const { x, y } = selection.getCursor();

      if (table_data.length > 0 && table_data[0].length > 0) {
        await quadraticCore.addDataTable({
          sheetId: sheets.current,
          x,
          y,
          name: table_name,
          values: table_data,
          firstRowIsHeader: true,
          cursor: sheets.getCursorPosition(),
        });

        ensureRectVisible({ x, y }, { x: x + table_data[0].length - 1, y: y + table_data.length - 1 });

        return `Executed add data table tool successfully with name: ${table_name}`;
      } else {
        return `data_table values are empty, cannot add data table without values`;
      }
    } catch (e) {
      return `Error executing set cell values tool: ${e}`;
    }
  },
  [AITool.SetCellValues]: async (args) => {
    const { top_left_position, cell_values } = args;
    try {
      const selection = stringToSelection(top_left_position, sheets.current, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return 'Invalid code cell position, this should be a single cell, not a range';
      }
      const { x, y } = selection.getCursor();

      if (cell_values.length > 0 && cell_values[0].length > 0) {
        await quadraticCore.setCellValues(sheets.current, x, y, cell_values, sheets.getCursorPosition());

        ensureRectVisible({ x, y }, { x: x + cell_values[0].length - 1, y: y + cell_values.length - 1 });

        return 'Executed set cell values tool successfully';
      } else {
        return 'cell_values are empty, cannot set cell values without values';
      }
    } catch (e) {
      return `Error executing set cell values tool: ${e}`;
    }
  },
  [AITool.SetCodeCellValue]: async (args) => {
    let { code_cell_language, code_string, code_cell_position, cell_name } = args;

    try {
      const sheetId = sheets.current;
      const selection = stringToSelection(code_cell_position, sheetId, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return 'Invalid code cell position, this should be a single cell, not a range';
      }
      const { x, y } = selection.getCursor();

      if (code_cell_language === 'Formula' && code_string.startsWith('=')) {
        code_string = code_string.slice(1);
      }

      // Determine the cell name - use provided cell_name or fallback to language-based name
      const cellName = cell_name ? cell_name : `${code_cell_language}Code`;

      // Create the code cell and set name in an optimized way
      const transactionId = await setCodeCellValueAndName(
        sheetId,
        x,
        y,
        code_string,
        code_cell_language,
        cellName,
        sheets.getCursorPosition()
      );

      if (transactionId) {
        // After execution, adjust viewport to show full output if it exists
        const table = pixiApp.cellsSheets.getById(sheetId)?.tables.getTableFromTableCell(x, y);
        if (table) {
          const width = table.codeCell.w;
          const height = table.codeCell.h;
          ensureRectVisible({ x, y }, { x: x + width - 1, y: y + height - 1 });
        }

        // Return result immediately
        const result = await setCodeCellResult(sheetId, x, y);
        return result;
      } else {
        return 'Error executing set code cell value tool';
      }
    } catch (e) {
      return `Error executing set code cell value tool: ${e}`;
    }
  },
  [AITool.MoveCells]: async (args) => {
    const { source_selection_rect, target_top_left_position } = args;
    try {
      const sourceSelection = stringToSelection(source_selection_rect, sheets.current, sheets.a1Context);
      const sourceRect = sourceSelection.getSingleRectangleOrCursor();
      if (!sourceRect) {
        return 'Invalid source selection, this should be a single rectangle, not a range';
      }
      const sheetRect: SheetRect = {
        min: {
          x: sourceRect.min.x,
          y: sourceRect.min.y,
        },
        max: {
          x: sourceRect.max.x,
          y: sourceRect.max.y,
        },
        sheet_id: {
          id: sheets.current,
        },
      };

      const targetSelection = stringToSelection(target_top_left_position, sheets.current, sheets.a1Context);
      if (!targetSelection.isSingleSelection()) {
        return 'Invalid code cell position, this should be a single cell, not a range';
      }
      const { x, y } = targetSelection.getCursor();

      await quadraticCore.moveCells(sheetRect, x, y, sheets.current, false, false);

      return `Executed move cells tool successfully.`;
    } catch (e) {
      return `Error executing move cells tool: ${e}`;
    }
  },
  [AITool.DeleteCells]: async (args) => {
    const { selection } = args;
    try {
      const sourceSelection = stringToSelection(selection, sheets.current, sheets.a1Context);

      await quadraticCore.deleteCellValues(sourceSelection.save(), sheets.getCursorPosition());

      return `Executed delete cells tool successfully.`;
    } catch (e) {
      return `Error executing delete cells tool: ${e}`;
    }
  },
  [AITool.UpdateCodeCell]: async (args) => {
    const { code_string } = args;
    try {
      if (!pixiAppSettings.setCodeEditorState) {
        throw new Error('setCodeEditorState is not defined');
      }

      const editorContent = pixiAppSettings.codeEditorState.diffEditorContent?.isApplied
        ? pixiAppSettings.codeEditorState.diffEditorContent.editorContent
        : pixiAppSettings.codeEditorState.editorContent;

      const codeCell = pixiAppSettings.codeEditorState.codeCell;

      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        diffEditorContent: { editorContent, isApplied: true },
        waitingForEditorClose: {
          codeCell,
          showCellTypeMenu: false,
          initialCode: code_string,
          inlineEditor: false,
        },
      }));

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId: codeCell.sheetId,
        x: codeCell.pos.x,
        y: codeCell.pos.y,
        codeString: code_string,
        language: codeCell.language,
        cursor: sheets.getCursorPosition(),
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        const result = await setCodeCellResult(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y);

        return (
          result +
          '\n\nUser is presented with diff editor, with accept and reject buttons, to revert the changes if needed'
        );
      } else {
        return 'Error executing update code cell tool';
      }
    } catch (e) {
      return `Error executing update code cell tool: ${e}`;
    }
  },
  [AITool.CodeEditorCompletions]: async () => {
    return `Code editor completions tool executed successfully, user is presented with a list of code completions, to choose from.`;
  },
  [AITool.UserPromptSuggestions]: async () => {
    return `User prompt suggestions tool executed successfully, user is presented with a list of prompt suggestions, to choose from.`;
  },
} as const;
