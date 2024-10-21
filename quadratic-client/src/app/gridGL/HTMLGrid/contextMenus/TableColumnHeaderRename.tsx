import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/TableName';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const TableColumnHeaderRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const position = useMemo(() => {
    if (
      contextMenu.type !== ContextMenuType.Table ||
      !contextMenu.rename ||
      !contextMenu.table ||
      contextMenu.selectedColumn === undefined
    ) {
      return;
    }
    return pixiApp.cellsSheets.current?.tables.getTableColumnHeaderPosition(
      contextMenu.table.x,
      contextMenu.table.y,
      contextMenu.selectedColumn
    );
  }, [contextMenu]);

  const originalHeaderName = useMemo(() => {
    if (!contextMenu.table || contextMenu.selectedColumn === undefined) {
      return;
    }
    return contextMenu.table.column_names[contextMenu.selectedColumn].name;
  }, [contextMenu.selectedColumn, contextMenu.table]);

  if (
    contextMenu.type !== ContextMenuType.Table ||
    !contextMenu.rename ||
    !contextMenu.table ||
    contextMenu.selectedColumn === undefined
  ) {
    return null;
  }

  return (
    <PixiRename
      defaultValue={originalHeaderName}
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
      noScale
    />
  );
};
