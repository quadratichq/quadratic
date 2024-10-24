//! This shows the table column's header context menu.

import { Action } from '@/app/actions/actions';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { TableIcon } from '@/shared/components/Icons';
import { ControlledMenu, MenuDivider, SubMenu } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

export const TableColumnContextMenu = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    if (contextMenu.type === ContextMenuType.TableColumn) {
      setContextMenu({});
      events.emit('contextMenuClose');
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

  const display =
    contextMenu.type === ContextMenuType.Table && contextMenu.column !== undefined && !contextMenu.rename
      ? 'block'
      : 'none';

  return (
    <div
      className="absolute"
      ref={ref}
      style={{
        left: contextMenu.world?.x ?? 0,
        top: contextMenu.world?.y ?? 0,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        pointerEvents: 'auto',
        display,
      }}
    >
      <ControlledMenu
        state={contextMenu?.world ? 'open' : 'closed'}
        onClose={onClose}
        anchorRef={ref}
        menuStyle={{ padding: '0', color: 'inherit' }}
        menuClassName="bg-background"
      >
        <MenuItemAction action={Action.RenameTableColumn} />
        <MenuDivider />
        <MenuItemAction action={Action.SortTableColumnAscending} />
        <MenuItemAction action={Action.SortTableColumnDescending} />
        <MenuDivider />
        <MenuItemAction action={Action.HideTableColumn} />
        <MenuDivider />
        <SubMenu
          className="text-sm"
          label={
            <div className="flex">
              <TableIcon className="-ml-3 mr-4" />
              <div>{contextMenu.table?.language === 'Import' ? 'Data' : 'Code'} Table</div>
            </div>
          }
        >
          <TableMenu codeCell={contextMenu.table} />
        </SubMenu>
      </ControlledMenu>
    </div>
  );
};
