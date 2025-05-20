import { Action } from '@/app/actions/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';
import { DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';
import { useEffect, useState } from 'react';

/**
 * Context menu for a regular cell _or_ a formula cell on the grid.
 */
export function GridContextMenuCell() {
  const [columnAvailable, setColumnAvailable] = useState(false);
  const [rowAvailable, setRowAvailable] = useState(false);
  const [canConvertToDataTable, setCanConvertToDataTable] = useState(false);

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
    };

    updateCursor();
    events.on('cursorPosition', updateCursor);
    events.on('contextMenu', updateCursor);

    return () => {
      events.off('contextMenu', updateCursor);
      events.off('cursorPosition', updateCursor);
    };
  }, []);

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
      {columnAvailable && <ContextMenuItemAction action={Action.InsertColumnLeft} />}
      {columnAvailable && <ContextMenuItemAction action={Action.InsertColumnRight} />}
      <ContextMenuItemAction action={Action.DeleteColumn} />
      {columnAvailable && (rowAvailable || canConvertToDataTable) && <DropdownMenuSeparator />}
      {rowAvailable && <ContextMenuItemAction action={Action.InsertRowAbove} />}
      {rowAvailable && <ContextMenuItemAction action={Action.InsertRowBelow} />}
      <ContextMenuItemAction action={Action.DeleteRow} />
      {canConvertToDataTable && (
        <>
          <DropdownMenuSeparator />
          <ContextMenuItemAction action={Action.GridToDataTable} />
        </>
      )}
    </ContextMenuBase>
  );
}
