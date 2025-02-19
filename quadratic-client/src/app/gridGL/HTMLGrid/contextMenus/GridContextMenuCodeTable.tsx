import { Action } from '@/app/actions/actions';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { CodeTableIcon } from '@/shared/components/Icons';
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilValue } from 'recoil';

export function GridContextMenuCodeTable() {
  const contextMenu = useRecoilValue(contextMenuAtom);
  const hasSpillError = Boolean(contextMenu.table?.spill_error);

  if (hasSpillError) {
    return (
      <ContextMenuBase>
        <ContextMenuItemAction action={Action.Cut} />
        <ContextMenuItemAction action={Action.Copy} />
        <ContextMenuItemAction action={Action.Paste} />
        <ContextMenuItemAction action={Action.PasteValuesOnly} />
        <ContextMenuItemAction action={Action.PasteFormattingOnly} />
        <DropdownMenuSeparator />
        <ContextMenuItemAction action={Action.EditTableCode} />
        <ContextMenuCodeTableItems />
      </ContextMenuBase>
    );
  }

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.Cut} />
      <ContextMenuItemAction action={Action.Copy} />
      <ContextMenuItemAction action={Action.Paste} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} />
      <ContextMenuItemAction action={Action.CopyAsPng} />
      <ContextMenuItemAction action={Action.DownloadAsCsv} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.EditTableCode} />
      <ContextMenuCodeTableItems />
    </ContextMenuBase>
  );
}

export const ContextMenuCodeTableNested = ({ isShowingColumnNames }: { isShowingColumnNames: boolean }) => {
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <span className="mr-1 flex h-6 w-6 items-center justify-center">
            <CodeTableIcon />
          </span>
          Code
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <ContextMenuCodeTableItems />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

export function ContextMenuCodeTableItems({ showUseFirstRowAsHeader }: { showUseFirstRowAsHeader?: boolean }) {
  return (
    <>
      <ContextMenuItemAction action={Action.RenameTable} />
      <ContextMenuItemAction action={Action.SortTable} />
      <ContextMenuItemAction action={Action.ShowAllColumns} />
      <ContextMenuItemAction action={Action.FlattenTable} />
      <ContextMenuItemAction action={Action.CodeToDataTable} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />
      <ContextMenuItemAction action={Action.ToggleTableName} />
      <ContextMenuItemAction action={Action.ToggleTableColumns} />
      <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />
    </>
  );
}
