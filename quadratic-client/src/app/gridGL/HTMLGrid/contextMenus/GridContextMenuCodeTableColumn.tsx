import { Action } from '@/app/actions/actions';
import { debug } from '@/app/debugFlags';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { ContextMenuCodeTableNested } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeTable';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';

export function GridContextMenuCodeTableColumn() {
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
      <ContextMenuItemAction action={Action.SortTableColumnAscending} />
      <ContextMenuItemAction action={Action.SortTableColumnDescending} />
      <DropdownMenuSeparator />

      {/* TODO:(ddimaria) wire this up to show appropriately nested menu for code tables */}
      <ContextMenuCodeTableNested isShowingColumnNames={true} />

      {debug && (
        <>
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.HideTableColumn} />
          <ContextMenuItemAction action={Action.ShowAllColumns} />
        </>
      )}
    </ContextMenuBase>
  );
}
