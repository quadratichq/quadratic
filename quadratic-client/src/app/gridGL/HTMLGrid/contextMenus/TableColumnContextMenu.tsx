//! This shows the table column's header context menu.

import { Action } from '@/app/actions/actions';
import { getColumns } from '@/app/actions/dataTableSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuBase';
import { ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { TableIcon } from '@/shared/components/Icons';
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const TableColumnContextMenu = () => {
  const { table } = useRecoilValue(contextMenuAtom);

  const hiddenColumns = getColumns()?.filter((c) => !c.display);

  const hasHiddenColumns = useMemo(() => {
    if (!hiddenColumns) return false;

    return hiddenColumns?.length > 0;
  }, [hiddenColumns]);

  const isImageOrHtmlCell = useMemo(() => {
    if (!table) return false;
    return (
      htmlCellsHandler.isHtmlCell(table.x, table.y) || pixiApp.cellsSheet().cellsImages.isImageCell(table.x, table.y)
    );
  }, [table]);

  const spillError = table?.spill_error;

  return (
    <ContextMenuBase contextMenuType={ContextMenuType.TableColumn}>
      {({ contextMenu }) => (
        <>
          <ContextMenuItemAction action={Action.RenameTableColumn} />
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.SortTableColumnAscending} />
          <ContextMenuItemAction action={Action.SortTableColumnDescending} />
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.HideTableColumn} />
          {!isImageOrHtmlCell && hasHiddenColumns && !spillError && (
            <ContextMenuItemAction action={Action.ShowAllColumns} />
          )}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TableIcon className="mr-4 flex h-6 w-6 items-center justify-center" />
              {contextMenu.table?.language === 'Import' ? 'Data' : 'Code'} Table
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Test</DropdownMenuItem>
              <TableMenu codeCell={contextMenu.table} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}
    </ContextMenuBase>
  );
};
