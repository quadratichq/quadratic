//! This shows the grid heading context menu.

import { Action } from '@/app/actions/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ContextMenuBase } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuBase';
import { ContextMenuItem, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { TableIcon } from '@/shared/components/Icons';
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useEffect, useState } from 'react';

export const GridContextMenu = () => {
  const [columnRowAvailable, setColumnRowAvailable] = useState(false);
  const [canConvertToDataTable, setCanConvertToDataTable] = useState(false);
  const [table, setTable] = useState<JsRenderCodeCell | undefined>();
  useEffect(() => {
    const updateCursor = () => {
      setColumnRowAvailable(sheets.sheet.cursor.hasOneColumnRowSelection(true));
      setCanConvertToDataTable(sheets.sheet.cursor.canConvertToDataTable());
      const codeCell = pixiApp.cellsSheet().cursorOnDataTable();
      setTable(codeCell);
    };

    updateCursor();
    events.on('contextMenu', updateCursor);

    return () => {
      events.off('contextMenu', updateCursor);
    };
  }, []);

  return (
    <ContextMenuBase contextMenuType={ContextMenuType.Grid}>
      {({ contextMenu }) => (
        <>
          <ContextMenuItemAction action={Action.Cut} />
          <ContextMenuItemAction action={Action.Copy} />
          <ContextMenuItemAction action={Action.Paste} />
          <ContextMenuItemAction action={Action.PasteValuesOnly} />
          <ContextMenuItemAction action={Action.PasteFormattingOnly} />
          <ContextMenuItemAction action={Action.CopyAsPng} />
          <ContextMenuItemAction action={Action.DownloadAsCsv} />

          {contextMenu.column === null || !!table ? null : (
            <>
              <DropdownMenuSeparator />
              {columnRowAvailable && <ContextMenuItemAction action={Action.InsertColumnLeft} />}
              {columnRowAvailable && <ContextMenuItemAction action={Action.InsertColumnRight} />}
              <ContextMenuItemAction action={Action.DeleteColumn} />
            </>
          )}

          {contextMenu.row === null || !!table ? null : (
            <>
              {columnRowAvailable && <DropdownMenuSeparator />}
              {columnRowAvailable && <ContextMenuItemAction action={Action.InsertRowAbove} />}
              {columnRowAvailable && <ContextMenuItemAction action={Action.InsertRowBelow} />}
              <ContextMenuItemAction action={Action.DeleteRow} />
            </>
          )}

          {canConvertToDataTable && <DropdownMenuSeparator />}
          {canConvertToDataTable && <ContextMenuItemAction action={Action.GridToDataTable} />}

          {table && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ContextMenuItem icon={<TableIcon />} text={'Table'} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <TableMenu defaultEdit={false} codeCell={table} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </>
      )}
    </ContextMenuBase>
  );
};
