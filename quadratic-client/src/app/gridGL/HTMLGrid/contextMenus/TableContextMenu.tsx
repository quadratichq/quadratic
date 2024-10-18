//! This shows the table context menu.

import { Action } from '@/app/actions/actions';
import { contextMenuAtom, ContextMenuSpecial, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ControlledMenu, MenuDivider } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

export const TableContextMenu = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    if (contextMenu.type === ContextMenuType.Table && contextMenu.special === ContextMenuSpecial.rename) {
      return;
    }
    setContextMenu({});
    events.emit('contextMenuClose');
    focusGrid();
  }, [contextMenu.special, contextMenu.type, setContextMenu]);

  useEffect(() => {
    pixiApp.viewport.on('moved', onClose);
    pixiApp.viewport.on('zoomed', onClose);

    return () => {
      pixiApp.viewport.off('moved', onClose);
      pixiApp.viewport.off('zoomed', onClose);
    };
  }, [onClose]);

  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className="absolute"
      ref={ref}
      style={{
        left: contextMenu.world?.x ?? 0,
        top: contextMenu.world?.y ?? 0,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        pointerEvents: 'auto',
        display: contextMenu.type === ContextMenuType.Table && !contextMenu.special ? 'block' : 'none',
      }}
    >
      <ControlledMenu
        state={contextMenu?.world ? 'open' : 'closed'}
        onClose={onClose}
        anchorRef={ref}
        menuStyle={{ padding: '0', color: 'inherit' }}
        menuClassName="bg-background"
      >
        <MenuItemAction action={Action.RenameDataTable} />
        <MenuDivider />
        <MenuItemAction action={Action.ToggleHeaderDataTable} />
        <MenuItemAction action={Action.ToggleFirstRowAsHeaderDataTable} />
        <MenuDivider />
        <MenuItemAction action={Action.FlattenDataTable} />
      </ControlledMenu>
    </div>
  );
};
