import { sheets } from '@/app/grid/controller/Sheets';
import type { ColumnRowResize } from '@/app/gridGL/interaction/pointer/PointerHeading';
import { content } from '@/app/gridGL/pixiApp/Content';
import { columnNameToIndex, type JsSelection } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
    CELL_HEIGHT,
    CELL_TEXT_MARGIN_LEFT,
    CELL_WIDTH,
    MAX_CELL_HEIGHT,
    MAX_CELL_WIDTH,
    MIN_CELL_HEIGHT,
    MIN_CELL_WIDTH,
} from '@/shared/constants/gridConstants';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type RowColumnToolActions = {
  [K in
    | AITool.ResizeColumns
    | AITool.ResizeRows
    | AITool.SetDefaultColumnWidth
    | AITool.SetDefaultRowHeight
    | AITool.InsertColumns
    | AITool.InsertRows
    | AITool.DeleteColumns
    | AITool.DeleteRows]: (args: AIToolsArgs[K]) => Promise<ToolResultContent>;
};

export const rowColumnToolsActions: RowColumnToolActions = {
  [AITool.ResizeColumns]: async (args) => {
    try {
      const { sheet_name, selection, size } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Error executing resize columns tool. Invalid selection: ${e.message}.`)];
      }

      let columns: Uint32Array;
      try {
        columns = jsSelection.getColumnsWithSelectedCells(sheets.jsA1Context);
      } catch (e: any) {
        return [
          createTextContent(`Error executing resize columns tool. Unable to get selected columns: ${e.message}.`),
        ];
      }

      if (columns.length === 0) {
        return [createTextContent('No columns selected.')];
      }

      const resizing: ColumnRowResize[] = [];
      for (const column of columns) {
        let newSize: number;
        if (size === 'auto') {
          const maxWidth = await content.cellsSheets.getCellsContentMaxWidth(column);
          if (maxWidth === 0) {
            newSize = CELL_WIDTH;
          } else {
            const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
            newSize = Math.max(contentSizePlusMargin, MIN_CELL_WIDTH);
          }
        } else if (size === 'default') {
          newSize = CELL_WIDTH;
        } else if (typeof size === 'number') {
          newSize = Math.max(MIN_CELL_WIDTH, Math.min(MAX_CELL_WIDTH, size));
        } else {
          newSize = CELL_WIDTH;
        }

        const originalSize = sheets.sheet.offsets.getColumnWidth(column);
        if (originalSize !== newSize) {
          resizing.push({ index: column, size: newSize });
        }
      }

      if (resizing.length) {
        const response = await quadraticCore.resizeColumns(sheetId, resizing, true);
        if (response?.result) {
          return [createTextContent(`Resize columns tool executed successfully.`)];
        } else {
          return [createTextContent(`Error executing resize columns tool: ${response?.error}`)];
        }
      } else {
        return [createTextContent('No columns selected.')];
      }
    } catch (e) {
      return [createTextContent(`Error executing resize columns tool: ${e}`)];
    }
  },
  [AITool.ResizeRows]: async (args) => {
    try {
      const { sheet_name, selection, size } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Error executing resize rows tool. Invalid selection: ${e.message}.`)];
      }

      let rows: Uint32Array;
      try {
        rows = jsSelection.getRowsWithSelectedCells(sheets.jsA1Context);
      } catch (e: any) {
        return [createTextContent(`Error executing resize rows tool. Unable to get selected rows: ${e.message}.`)];
      }

      if (rows.length === 0) {
        return [createTextContent('No rows selected.')];
      }

      const resizing: ColumnRowResize[] = [];
      for (const row of rows) {
        let newSize: number;
        if (size === 'auto') {
          const maxHeight = await content.cellsSheets.getCellsContentMaxHeight(row);
          newSize = Math.max(maxHeight, CELL_HEIGHT);
        } else if (size === 'default') {
          newSize = CELL_HEIGHT;
        } else if (typeof size === 'number') {
          newSize = Math.max(MIN_CELL_HEIGHT, Math.min(MAX_CELL_HEIGHT, size));
        } else {
          newSize = CELL_HEIGHT;
        }

        const originalSize = sheets.sheet.offsets.getRowHeight(row);
        if (originalSize !== newSize) {
          resizing.push({ index: row, size: newSize });
        }
      }

      if (resizing.length) {
        // When AI uses size 'auto', set clientResized to false so rows auto-recalculate on font changes
        // When AI specifies a pixel value, set clientResized to true since it's a deliberate size
        const clientResized = size !== 'auto';
        const response = await quadraticCore.resizeRows(sheetId, resizing, true, clientResized);
        if (response?.result) {
          return [createTextContent('Resize rows tool executed successfully.')];
        } else {
          return [createTextContent(`Error executing resize rows tool: ${response?.error}`)];
        }
      } else {
        return [createTextContent('No rows selected.')];
      }
    } catch (e) {
      return [createTextContent(`Error executing resize rows tool: ${e}`)];
    }
  },
  [AITool.SetDefaultColumnWidth]: async (args) => {
    try {
      const { sheet_name, size } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetName = sheets.getSheetByName(sheet_name ?? '')?.name ?? sheets.sheet.name;

      const clampedSize = Math.max(MIN_CELL_WIDTH, Math.min(MAX_CELL_WIDTH, size));
      quadraticCore.resizeAllColumns(sheetId, clampedSize, true);

      return [
        createTextContent(
          `Set default column width to ${clampedSize} pixels in sheet "${sheetName}". All columns without custom widths will now use this size.`
        ),
      ];
    } catch (e) {
      return [createTextContent(`Error setting default column width: ${e}`)];
    }
  },
  [AITool.SetDefaultRowHeight]: async (args) => {
    try {
      const { sheet_name, size } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetName = sheets.getSheetByName(sheet_name ?? '')?.name ?? sheets.sheet.name;

      const clampedSize = Math.max(MIN_CELL_HEIGHT, Math.min(MAX_CELL_HEIGHT, size));
      quadraticCore.resizeAllRows(sheetId, clampedSize, true);

      return [
        createTextContent(
          `Set default row height to ${clampedSize} pixels in sheet "${sheetName}". All rows without custom heights will now use this size.`
        ),
      ];
    } catch (e) {
      return [createTextContent(`Error setting default row height: ${e}`)];
    }
  },
  [AITool.InsertColumns]: async (args) => {
    try {
      const { sheet_name, column, right, count } = args;
      const columnIndex = columnNameToIndex(column);
      if (columnIndex === undefined) {
        return [createTextContent(`Error executing insert columns tool. Invalid column: ${column}.`)];
      }

      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // the "right" if weird: it's what column we use for formatting, so we need to add 1 if we're inserting to the right
      const response = await quadraticCore.insertColumns(
        sheetId,
        Number(columnIndex) + (right ? 1 : 0),
        count,
        !right,
        true
      );
      if (response?.result) {
        return [createTextContent('Insert columns tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing insert columns tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing insert columns tool: ${e}`)];
    }
  },
  [AITool.InsertRows]: async (args) => {
    try {
      const { sheet_name, row, below, count } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      // The "below" param is what row we use for formatting, so we need to add 1 if we're inserting below
      const response = await quadraticCore.insertRows(sheetId, row + (below ? 1 : 0), count, !below, true);
      if (response?.result) {
        return [createTextContent(`Inserted ${count} row(s) ${below ? 'below' : 'above'} row ${row}.`)];
      } else {
        return [createTextContent(`Error executing insert rows tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing insert rows tool: ${e}`)];
    }
  },
  [AITool.DeleteColumns]: async (args) => {
    try {
      const { sheet_name, columns } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const columnIndicies = columns.flatMap((column) => {
        const columnIndex = columnNameToIndex(column);
        if (columnIndex === undefined) {
          return [];
        }
        return [Number(columnIndex)];
      });
      const response = await quadraticCore.deleteColumns(sheetId, columnIndicies, true);
      if (response?.result) {
        return [createTextContent('Delete columns tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing delete columns tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete columns tool: ${e}`)];
    }
  },
  [AITool.DeleteRows]: async (args) => {
    try {
      const { sheet_name, rows } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.deleteRows(sheetId, rows, true);
      if (response?.result) {
        return [createTextContent(`Deleted row(s) ${rows.join(', ')}.`)];
      } else {
        return [createTextContent(`Error executing delete rows tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete rows tool: ${e}`)];
    }
  },
} as const;
