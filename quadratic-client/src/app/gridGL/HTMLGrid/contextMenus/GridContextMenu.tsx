//! This shows the grid heading context menu.

import { Action } from '@/app/actions/actions';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtoms';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ControlledMenu, MenuDivider } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { pixiApp } from '../../pixiApp/PixiApp';

export const GridContextMenu = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    setContextMenu({});
    events.emit('contextMenuClose');
    focusGrid();
  }, [setContextMenu]);

  useEffect(() => {
    pixiApp.viewport.on('moved', onClose);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', onClose);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  const ref = useRef<HTMLDivElement>(null);

  const isColumnRowAvailable = sheets.sheet.cursor.hasOneColumnRowSelection(true);
  const isMultiSelectOnly = sheets.sheet.cursor.hasOneMultiselect();

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
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertColumnLeft} />}
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertColumnRight} />}
            <MenuItemAction action={Action.DeleteColumn} />
          </>
        )}

        {contextMenu.row === null ? null : (
          <>
            {isColumnRowAvailable && <MenuDivider />}
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertRowAbove} />}
            {isColumnRowAvailable && <MenuItemAction action={Action.InsertRowBelow} />}
            <MenuItemAction action={Action.DeleteRow} />
          </>
        )}

        <MenuDivider />
        {isMultiSelectOnly && <MenuItemAction action={Action.GridToDataTable} />}
      </ControlledMenu>
    </div>
  );
};
