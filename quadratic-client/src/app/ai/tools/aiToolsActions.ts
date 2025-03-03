import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import type { SheetRect } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { z } from 'zod';

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
    let { code_cell_language, code_string, code_cell_position, output_width, output_height } = args;
    try {
      const selection = stringToSelection(code_cell_position, sheets.current, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return 'Invalid code cell position, this should be a single cell, not a range';
      }
      const { x, y } = selection.getCursor();

      if (code_cell_language === 'Formula' && code_string.startsWith('=')) {
        code_string = code_string.slice(1);
      }

      quadraticCore.setCodeCellValue({
        sheetId: sheets.current,
        x,
        y,
        codeString: code_string,
        language: code_cell_language,
        cursor: sheets.getCursorPosition(),
      });

      ensureRectVisible({ x, y }, { x: x + output_width - 1, y: y + output_height - 1 });

      return 'Executed set code cell value tool successfully';
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

      await quadraticCore.moveCells(sheetRect, x, y, sheets.current);

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
} as const;
