//! This shows the grid heading context menu.

import { Action } from '@/app/actions/actions';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ControlledMenu, MenuDivider } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { pixiApp } from '../../pixiApp/PixiApp';

export const GridContextMenu = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    if (contextMenu.type === ContextMenuType.Grid) {
      setContextMenu({});
      focusGrid();
    }
  }, [contextMenu.type, setContextMenu]);

  useEffect(() => {
    pixiApp.viewport.on('moved', onClose);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', onClose);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  const ref = useRef<HTMLDivElement>(null);

  const [columnRowAvailable, setColumnRowAvailable] = useState(false);
  const [canConvertToDataTable, setCanConvertToDataTable] = useState(false);
  useEffect(() => {
    const updateCursor = () => {
      setColumnRowAvailable(sheets.sheet.cursor.hasOneColumnRowSelection(true));
      setCanConvertToDataTable(sheets.sheet.cursor.canConvertToDataTable());
    };

    updateCursor();
    events.on('cursorPosition', updateCursor);

    return () => {
      events.off('cursorPosition', updateCursor);
    };
  }, []);

  return (
    <div
      className="absolute"
      ref={ref}
      style={{
        left: contextMenu.world?.x ?? 0,
        top: contextMenu.world?.y ?? 0,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        pointerEvents: 'auto',
        display: contextMenu.type === ContextMenuType.Grid ? 'block' : 'none',
      }}
    >
      <ControlledMenu
        state={contextMenu?.world ? 'open' : 'closed'}
        onClose={onClose}
        anchorRef={ref}
        menuStyle={{ padding: '0', color: 'inherit' }}
        menuClassName="bg-background"
      >
        <MenuItemAction action={Action.Cut} />
        <MenuItemAction action={Action.Copy} />
        <MenuItemAction action={Action.Paste} />
        <MenuItemAction action={Action.PasteValuesOnly} />
        <MenuItemAction action={Action.PasteFormattingOnly} />
        <MenuItemAction action={Action.CopyAsPng} />
        <MenuItemAction action={Action.DownloadAsCsv} />

        {contextMenu.column === null ? null : (
          <>
            <MenuDivider />
            {columnRowAvailable && <MenuItemAction action={Action.InsertColumnLeft} />}
            {columnRowAvailable && <MenuItemAction action={Action.InsertColumnRight} />}
            <MenuItemAction action={Action.DeleteColumn} />
          </>
        )}

        {contextMenu.row === null ? null : (
          <>
            {columnRowAvailable && <MenuDivider />}
            {columnRowAvailable && <MenuItemAction action={Action.InsertRowAbove} />}
            {columnRowAvailable && <MenuItemAction action={Action.InsertRowBelow} />}
            <MenuItemAction action={Action.DeleteRow} />
          </>
        )}

        {canConvertToDataTable && <MenuDivider />}
        {canConvertToDataTable && <MenuItemAction action={Action.GridToDataTable} />}
      </ControlledMenu>
    </div>
  );
};
