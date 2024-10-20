import { contextMenuAtom, ContextMenuSpecial, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/TableName';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const TableRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const position = useMemo(() => {
    if (
      contextMenu.type !== ContextMenuType.Table ||
      contextMenu.special !== ContextMenuSpecial.rename ||
      !contextMenu.table
    ) {
      return;
    }
    return pixiApp.cellsSheets.current?.tables.getTableNamePosition(contextMenu.table.x, contextMenu.table.y);
  }, [contextMenu]);

  if (
    contextMenu.type !== ContextMenuType.Table ||
    contextMenu.special !== ContextMenuSpecial.rename ||
    !contextMenu.table
  ) {
    return null;
  }

  return (
    <PixiRename
      defaultValue={contextMenu.table.name}
      position={position}
      className="origin-bottom-left bg-primary px-3 text-sm font-bold text-primary-foreground"
      styles={{ fontSize: TABLE_NAME_FONT_SIZE, paddingLeft: TABLE_NAME_PADDING[0] }}
      onSave={() => {
        if (contextMenu.table) {
          console.log('TODO: rename table');
          // quadraticCore.renameDataTable(contextMenu.table.id, contextMenu.table.name);
        }
      }}
      onClose={() => events.emit('contextMenu', {})}
    />
  );
};
