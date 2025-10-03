import { Action } from '@/app/actions/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { content } from '@/app/gridGL/pixiApp/Content';
import { useCursorPosition } from '@/app/ui/hooks/useCursorPosition';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';
import { useEffect, useState } from 'react';

/**
 * Context menu for a regular cell _or_ a formula cell on the grid.
 */
export function GridContextMenuCell() {
  const [columnAvailable, setColumnAvailable] = useState(false);
  const [rowAvailable, setRowAvailable] = useState(false);
  const [canConvertToDataTable, setCanConvertToDataTable] = useState(false);
  const [canRunSelection, setCanRunSelection] = useState(false);
  const { cursorStringWithSheetName } = useCursorPosition();

  useEffect(() => {
    const updateCursor = () => {
      if (sheets.sheet.cursor.canInsertColumnRow()) {
        setColumnAvailable(sheets.sheet.cursor.canInsertColumn());
        setRowAvailable(sheets.sheet.cursor.canInsertRow());
      } else {
        setColumnAvailable(false);
        setRowAvailable(false);
      }
      setCanConvertToDataTable(sheets.sheet.cursor.canConvertToDataTable());
      setCanRunSelection(content.cellsSheet.tables.hasCodeCellInCurrentSelection());
    };

    updateCursor();
    events.on('cursorPosition', updateCursor);
    events.on('contextMenu', updateCursor);

    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('contextMenu', updateCursor);
    };
  }, []);

  return (
    <ContextMenuBase>
      {canRunSelection && <ContextMenuItemAction action={Action.ExecuteCode} actionArgs={undefined} />}
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

      {columnAvailable && <ContextMenuItemAction action={Action.InsertColumnLeft} actionArgs={undefined} />}
      {columnAvailable && <ContextMenuItemAction action={Action.InsertColumnRight} actionArgs={undefined} />}
      <ContextMenuItemAction action={Action.DeleteColumn} actionArgs={undefined} />

      <DropdownMenuSeparator />

      {rowAvailable && <ContextMenuItemAction action={Action.InsertRowAbove} actionArgs={undefined} />}
      {rowAvailable && <ContextMenuItemAction action={Action.InsertRowBelow} actionArgs={undefined} />}
      <ContextMenuItemAction action={Action.DeleteRow} actionArgs={undefined} />

      <DropdownMenuSeparator />

      {canConvertToDataTable && <ContextMenuItemAction action={Action.GridToDataTable} actionArgs={undefined} />}
    </ContextMenuBase>
  );
}
