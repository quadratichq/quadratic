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
  const [columnRowAvailable, setColumnRowAvailable] = useState(false);
  const [canConvertToDataTable, setCanConvertToDataTable] = useState(false);

  useEffect(() => {
    const updateCursor = () => {
      setColumnRowAvailable(sheets.sheet.cursor.hasOneColumnRowSelection(true));
      setCanConvertToDataTable(sheets.sheet.cursor.canConvertToDataTable());
    };

    updateCursor();
    events.on('contextMenu', updateCursor);

    return () => {
      events.off('contextMenu', updateCursor);
    };
  }, []);

  // TODO:(ddimaria) Insert columns isn't showing when right-clicking a formula cell
  // Seems to be an issue with `hasOneColumnRowSelection` which doesn't return true for a single cell if it's a formula

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
      {columnRowAvailable && <ContextMenuItemAction action={Action.InsertColumnLeft} />}
      {columnRowAvailable && <ContextMenuItemAction action={Action.InsertColumnRight} />}
      <ContextMenuItemAction action={Action.DeleteColumn} />
      {columnRowAvailable && <DropdownMenuSeparator />}
      {columnRowAvailable && <ContextMenuItemAction action={Action.InsertRowAbove} />}
      {columnRowAvailable && <ContextMenuItemAction action={Action.InsertRowBelow} />}
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
