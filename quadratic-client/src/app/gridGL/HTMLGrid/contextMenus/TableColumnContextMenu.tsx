//! This shows the table column's header context menu.

import { Action } from '@/app/actions/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { ContextMenu } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuNew';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';
import { TableIcon } from '@/shared/components/Icons';
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';

export const TableColumnContextMenu = () => {
  return (
    <ContextMenu contextMenuType={ContextMenuType.TableColumn}>
      {({ contextMenu }) => (
        <>
          <ContextMenuItemAction action={Action.RenameTableColumn} />
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.SortTableColumnAscending} />
          <ContextMenuItemAction action={Action.SortTableColumnDescending} />
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.HideTableColumn} />
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TableIcon className="-ml-3 mr-4" />
              {contextMenu.table?.language === 'Import' ? 'Data' : 'Code'} Table
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Test</DropdownMenuItem>
              <TableMenu codeCell={contextMenu.table} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}
    </ContextMenu>
  );
};
