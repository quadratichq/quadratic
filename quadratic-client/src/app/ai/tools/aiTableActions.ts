import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import type { JsDataTableColumnHeader } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type TableToolActions = {
  [K in AITool.ConvertToTable | AITool.TableMeta | AITool.TableColumnSettings]: (
    args: AIToolsArgs[K]
  ) => Promise<ToolResultContent>;
};

export const tableToolsActions: TableToolActions = {
  [AITool.ConvertToTable]: async (args) => {
    try {
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRectString(sheetId, args.selection);
      if (!sheetRect) {
        return [createTextContent('Invalid selection, this should be a single rectangle, not a range')];
      }
      const response = await quadraticCore.gridToDataTable(
        sheetRect,
        args.table_name,
        args.first_row_is_column_names,
        true
      );
      if (response?.result) {
        return [createTextContent('Converted sheet data to table.')];
      } else {
        return [createTextContent(`Error executing convert to table tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing convert to table tool: ${e}`)];
    }
  },
  [AITool.TableMeta]: async (args) => {
    try {
      const {
        sheet_name,
        table_location,
        first_row_is_column_names,
        new_table_name,
        show_name,
        show_columns,
        alternating_row_colors,
      } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRect(sheetId, table_location);
      if (first_row_is_column_names !== undefined && first_row_is_column_names !== null) {
        const response = await quadraticCore.dataTableFirstRowAsHeader(
          sheetId,
          Number(sheetRect.min.x),
          Number(sheetRect.min.y),
          first_row_is_column_names,
          true
        );
        if (!response?.result) {
          return [createTextContent(`Error executing table meta tool: ${response?.error}`)];
        }
      }
      if (
        (new_table_name !== undefined && new_table_name !== null) ||
        (show_name !== undefined && show_name !== null) ||
        (show_columns !== undefined && show_columns !== null) ||
        (alternating_row_colors !== undefined && alternating_row_colors !== null)
      ) {
        const response = await quadraticCore.dataTableMeta(
          sheetId,
          Number(sheetRect.min.x),
          Number(sheetRect.min.y),
          {
            name: new_table_name ?? undefined,
            alternatingColors: alternating_row_colors ?? undefined,
            showName: show_name ?? undefined,
            showColumns: show_columns ?? undefined,
          },
          true
        );
        if (!response?.result) {
          return [createTextContent(`Error executing table meta tool: ${response?.error}`)];
        }
      }
      return [createTextContent('Set table meta tool executed successfully.')];
    } catch (e) {
      return [createTextContent(`Error executing table meta tool: ${e}`)];
    }
  },
  [AITool.TableColumnSettings]: async (args) => {
    try {
      const { sheet_name, table_location, column_names } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRect(sheetId, table_location);
      const sheet = content.cellsSheets.getById(sheetId);
      if (!sheet) {
        return [createTextContent(`Error executing table column settings tool. Sheet not found: ${sheet_name}.`)];
      }
      const table = sheet.tables.getTable(sheetRect.min.x, sheetRect.min.y);
      if (!table) {
        return [createTextContent(`Error executing table column settings tool. Table not found at ${table_location}.`)];
      }
      // convert the ai response to the format expected by the core
      const columns: JsDataTableColumnHeader[] = table.codeCell.columns.map((column, i) => {
        const changedColumn = column_names.find((c) => c.old_name.toLowerCase() === column.name.toLowerCase());
        return changedColumn
          ? { valueIndex: i, name: changedColumn.new_name, display: changedColumn.show }
          : { valueIndex: i, name: column.name, display: column.display };
      });
      const response = await quadraticCore.dataTableMeta(
        sheetId,
        Number(sheetRect.min.x),
        Number(sheetRect.min.y),
        { columns },
        true
      );
      if (response?.result) {
        return [createTextContent('Rename table columns tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing rename table columns tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing table column settings tool: ${e}`)];
    }
  },
} as const;
