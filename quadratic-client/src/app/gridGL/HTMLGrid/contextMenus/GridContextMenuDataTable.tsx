import { Action } from '@/app/actions/actions';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { TableIcon } from '@/shared/components/Icons';

import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilValue } from 'recoil';

export const GridContextMenuDataTable = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);
  const hasSpillError = Boolean(contextMenu.table?.spill_error);

  if (hasSpillError) {
    return (
      <ContextMenuBase>
        <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
        <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      </ContextMenuBase>
    );
  }

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Paste} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.CopyAsPng} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.DownloadAsCsv} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuDataTableItems highlightDefault={true} />
    </ContextMenuBase>
  );
};

// Used by <GridContextMenuTableData*> components to show nested table actions
export const ContextMenuDataTableNested = ({ isShowingColumnNames }: { isShowingColumnNames: boolean }) => {
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <span className="mr-1 flex h-6 w-6 items-center justify-center">
            <TableIcon />
          </span>
          Table
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <ContextMenuDataTableItems />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

export const ContextMenuDataTableItems = ({ highlightDefault }: { highlightDefault?: boolean }) => {
  return (
    <>
      <ContextMenuItemAction
        action={Action.RenameTable}
        actionArgs={undefined}
        overrideDefaultOption={highlightDefault}
      />
      <ContextMenuItemAction action={Action.SortTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ShowAllColumns} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.FlattenTable} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ToggleTableName} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ToggleTableColumns} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.DeleteDataTable} actionArgs={undefined} />
    </>
  );
};
