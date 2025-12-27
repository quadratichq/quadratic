import { getTable } from '@/app/actions/dataTableSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { GridContextMenuCell } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCell';
import { GridContextMenuCodeCellOutput } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeCellOutput';
import { GridContextMenuCodeTable } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeTable';
import { GridContextMenuCodeTableCell } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeTableCell';
import { GridContextMenuCodeTableChart } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeTableChart';
import { GridContextMenuCodeTableColumn } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeTableColumn';
import { GridContextMenuDataTable } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuDataTable';
import { GridContextMenuDataTableCell } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuDataTableCell';
import { GridContextMenuDataTableColumn } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuDataTableColumn';
import { useRecoilValue } from 'recoil';

/**
 * Different context menus based on the current cursor selection:
 *
 * <GridContextMenuCell> - Cell(s) on the grid
 * <GridContextMenuDataTable> - Data table selection
 * <GridContextMenuDataTableColumn> - Data table column selection
 * <GridContextMenuDataTableCell> - Data table cell that's selected
 * <GridContextMenuCodeTable> - Code table selection
 * <GridContextMenuCodeTableColumn> - Code table column selection
 * <GridContextMenuCodeTableCell> - Code table cell that's selected
 * <GridContextMenuCodeTableChart> - Chart table selection
 */
export const GridContextMenu = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);
  let cursor = sheets.sheet.cursor;
  const fullColumnSelection = cursor.getTableColumnSelection(getTable()?.name || '');

  if (contextMenu.type === ContextMenuType.Table && contextMenu.table) {
    if (contextMenu.table.language === 'Import') {
      return <GridContextMenuDataTable />;
    }

    // Chart
    if (contextMenu.table.is_html || contextMenu.table.is_html_image) {
      return <GridContextMenuCodeTableChart />;
    }

    // Code
    return <GridContextMenuCodeTable />;

    // TODO:(ddimaria/jimniels) How do we handle spill errors for different menus?
  }

  // This isn't a context menu, but more of a menu that pops up when you click 'sort' on a table
  if (contextMenu.type === ContextMenuType.TableSort) {
    return null;
  }

  // Context menu for double-clicking on code cell output data area
  if (contextMenu.type === ContextMenuType.CodeCellOutput) {
    return <GridContextMenuCodeCellOutput />;
  }

  // It's a table column selection
  if ((contextMenu.type === ContextMenuType.TableColumn || fullColumnSelection) && contextMenu.table) {
    // Data table
    if (contextMenu.table.language === 'Import') {
      return <GridContextMenuDataTableColumn />;
    }
    // Code table
    return <GridContextMenuCodeTableColumn />;
  }

  // It's a grid selection
  if (contextMenu.type === ContextMenuType.Grid) {
    // Is it a cell in a table?
    if (contextMenu.table) {
      // Data table
      if (contextMenu.table.language === 'Import') {
        return <GridContextMenuDataTableCell />;
      }
      // Formula
      if (contextMenu.table.language === 'Formula') {
        return <GridContextMenuCell />;
      }
      // Code table
      return <GridContextMenuCodeTableCell />;
    }
    // It's a grid cell
    return <GridContextMenuCell />;
  }

  return null;
};
