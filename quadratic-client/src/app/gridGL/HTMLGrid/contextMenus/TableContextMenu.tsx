//! This shows the table context menu.

import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ControlledMenu } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

export const TableContextMenu = () => {
  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);

  const onClose = useCallback(() => {
    if (
      contextMenu.type !== ContextMenuType.Table ||
      (contextMenu.type === ContextMenuType.Table && !contextMenu.rename)
    ) {
      return;
    }
    setContextMenu({});
    events.emit('contextMenuClose');
    focusGrid();
  }, [contextMenu.rename, contextMenu.type, setContextMenu]);

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
        display:
          contextMenu.type === ContextMenuType.TableColumn && contextMenu.selectedColumn !== undefined
            ? 'block'
            : 'none',
      }}
    >
      <ControlledMenu
        state={contextMenu?.world ? 'open' : 'closed'}
        onClose={onClose}
        anchorRef={ref}
        menuStyle={{ padding: '0', color: 'inherit' }}
        menuClassName="bg-background"
      >
        <TableMenu codeCell={contextMenu.table} />
      </ControlledMenu>
    </div>
  );
};
