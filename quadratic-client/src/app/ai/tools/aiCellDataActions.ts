import { AICellResultToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import type { SheetRect } from '@/app/quadratic-core-types';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type CellDataToolActions = {
  [K in
    | AITool.AddDataTable
    | AITool.SetCellValues
    | AITool.GetCellData
    | AITool.HasCellData
    | AITool.MoveCells
    | AITool.DeleteCells]: (args: AIToolsArgs[K]) => Promise<ToolResultContent>;
};

export const cellDataToolsActions: CellDataToolActions = {
  [AITool.AddDataTable]: async (args) => {
    try {
      const { sheet_name, top_left_position, table_name, table_data } = args;
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = sheets.stringToSelection(top_left_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }
      const { x, y } = selection.getCursor();

      if (table_data.length > 0 && table_data[0].length > 0) {
        await quadraticCore.addDataTable({
          sheetId,
          x,
          y,
          name: table_name,
          values: table_data,
          firstRowIsHeader: true,
          isAi: true,
        });

        const endX = x + table_data[0].length - 1;
        const endY = y + table_data.length; // Don't subtract 1 to include the full table
        ensureRectVisible(sheetId, { x, y }, { x: endX, y: endY });

        // Update AI cursor to show selection over entire table
        try {
          const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
          const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, sheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection for data table:', e);
        }

        return [createTextContent(`Executed add data table tool successfully with name: ${table_name}`)];
      } else {
        return [createTextContent('data_table values are empty, cannot add data table without values')];
      }
    } catch (e) {
      return [createTextContent(`Error executing add data table tool: ${e}`)];
    }
  },
  [AITool.SetCellValues]: async (args) => {
    try {
      const { sheet_name, top_left_position, cell_values } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(top_left_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }
      const { x, y } = selection.getCursor();

      if (cell_values.length > 0 && cell_values[0].length > 0) {
        // Move AI cursor to show the range being written
        try {
          const endX = x + cell_values[0].length - 1;
          const endY = y + cell_values.length - 1;
          const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
          const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, sheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection:', e);
        }

        await quadraticCore.setCellValues(sheetId, x, y, cell_values, true);

        ensureRectVisible(sheetId, { x, y }, { x: x + cell_values[0].length - 1, y: y + cell_values.length - 1 });

        return [createTextContent('Executed set cell values tool successfully')];
      } else {
        return [createTextContent('cell_values are empty, cannot set cell values without values')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set cell values tool: ${e}`)];
    }
  },
  [AITool.GetCellData]: async (args) => {
    try {
      const { selection, sheet_name, page } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // Move AI cursor to the starting cell and show selection
      try {
        const jsSelection = sheets.stringToSelection(selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const response = await quadraticCore.getAICells(selection, sheetId, page);
      if (!response || typeof response === 'string' || ('error' in response && response.error)) {
        const error = typeof response === 'string' ? response : response?.error;
        return [createTextContent(`There was an error executing the get cells tool ${error}`)];
      } else if ('values' in response) {
        return [createTextContent(AICellResultToMarkdown(response))];
      } else {
        // should not be reached
        return [createTextContent('There was an error executing the get cells tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing get cell data tool: ${e}`)];
    }
  },
  [AITool.HasCellData]: async (args) => {
    try {
      const { selection, sheet_name } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.hasCellData(sheetId, selection);
      return [
        createTextContent(
          response
            ? `The selection "${args.selection}" in Sheet "${args.sheet_name}" has data.`
            : `The selection "${args.selection}" in Sheet "${args.sheet_name}" does not have data.`
        ),
      ];
    } catch (e) {
      return [createTextContent(`Error executing has cell data tool: ${e}`)];
    }
  },
  [AITool.MoveCells]: async (args) => {
    try {
      const { sheet_name, source_selection_rect, target_top_left_position } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sourceSelection = sheets.stringToSelection(source_selection_rect, sheetId);
      const sourceRect = sourceSelection.getSingleRectangleOrCursor(sheets.jsA1Context);
      if (!sourceRect) {
        return [createTextContent('Invalid source selection, this should be a single rectangle, not a range')];
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
          id: sheetId,
        },
      };

      const targetSelection = sheets.stringToSelection(target_top_left_position, sheetId);
      if (!targetSelection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }
      const { x, y } = targetSelection.getCursor();
      const rangeWidth = Number(sourceRect.max.x - sourceRect.min.x);
      const rangeHeight = Number(sourceRect.max.y - sourceRect.min.y);

      // Move AI cursor to show the target destination
      try {
        const targetRange = `${xyToA1(x, y)}:${xyToA1(x + rangeWidth, y + rangeHeight)}`;
        const jsSelection = sheets.stringToSelection(targetRange, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      await quadraticCore.moveCellsBatch([{ source: sheetRect, targetX: x, targetY: y, targetSheetId: sheetId }], true);

      // Move viewport to the target destination so the user can see where the content was moved
      ensureRectVisible(sheetId, { x, y }, { x: x + rangeWidth, y: y + rangeHeight });

      return [createTextContent('Executed move cells tool successfully.')];
    } catch (e) {
      return [createTextContent(`Error executing move cells tool: ${e}`)];
    }
  },
  [AITool.DeleteCells]: async (args) => {
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // Move AI cursor to the cells being deleted
      try {
        const jsSelection = sheets.stringToSelection(selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const sourceSelection = sheets.stringToSelection(selection, sheetId).save();
      const response = await quadraticCore.deleteCellValues(sourceSelection, true);
      if (response?.result) {
        return [createTextContent(`The selection ${args.selection} was deleted successfully.`)];
      } else {
        return [createTextContent(`There was an error executing the delete cells tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete cells tool: ${e}`)];
    }
  },
} as const;
