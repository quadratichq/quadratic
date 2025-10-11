import { Action } from '@/app/actions/actions';
import { dataTableSpec } from '@/app/actions/dataTableSpec';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { ContextMenuDataTableNested } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenuDataTable';
import { useCursorPosition } from '@/app/ui/hooks/useCursorPosition';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';
import { useRecoilValue } from 'recoil';

export function GridContextMenuDataTableCell() {
  const contextMenu = useRecoilValue(contextMenuAtom);
  const isShowingColumnNames = Boolean(contextMenu.table?.show_columns);
  const { cursorStringWithSheetName } = useCursorPosition();

  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.StartChatInAIAnalyst} actionArgs={cursorStringWithSheetName} />
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.Cut} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Copy} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.Paste} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteValuesOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.PasteFormattingOnly} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.CopyAsPng} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.DownloadAsCsv} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.InsertTableColumnLeft} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.InsertTableColumnRight} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.RemoveTableColumn} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction action={Action.InsertTableRowAbove} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.InsertTableRowBelow} actionArgs={undefined} />
      <ContextMenuItemAction action={Action.RemoveTableRow} actionArgs={undefined} />

      <DropdownMenuSeparator />

      <ContextMenuItemAction
        action={Action.HideTableColumn}
        actionArgs={undefined}
        labelOverride={dataTableSpec[Action.HideTableColumn].labelVerbose}
      />

      <DropdownMenuSeparator />

      <ContextMenuDataTableNested isShowingColumnNames={isShowingColumnNames} />
    </ContextMenuBase>
  );
}
