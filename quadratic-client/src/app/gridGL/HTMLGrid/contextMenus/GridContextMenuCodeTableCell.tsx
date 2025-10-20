import { Action } from '@/app/actions/actions';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { ContextMenuCodeTableNested } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuCodeTable';
import { useCursorPosition } from '@/app/ui/hooks/useCursorPosition';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';

export function GridContextMenuCodeTableCell() {
  // TODO: handle spill errors
  const { cursorStringWithSheetName } = useCursorPosition();
  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.AddReferenceToAIAnalyst} actionArgs={cursorStringWithSheetName} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Paste} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.CopyAsPng} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.DownloadAsCsv} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.EditTableCode} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.HideTableColumn} labelOverride={'Hide column'} actionArgs={undefined} />

      <DropdownMenuSeparator />

      {/* TODO:(ddimaria) wire this up to show appropriately nested menu for code tables */}
      <ContextMenuCodeTableNested isShowingColumnNames={false} />
    </ContextMenuBase>
  );
}
