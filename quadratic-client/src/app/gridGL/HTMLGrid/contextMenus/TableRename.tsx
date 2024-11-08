import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/TableName';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const TableRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const position = useMemo(() => {
    if (
      contextMenu.type !== ContextMenuType.Table ||
      !contextMenu.rename ||
      !contextMenu.table ||
      contextMenu.selectedColumn !== undefined
    ) {
      return;
    }
    return pixiApp.cellsSheets.current?.tables.getTableNamePosition(contextMenu.table.x, contextMenu.table.y);
  }, [contextMenu]);

  if (contextMenu.type !== ContextMenuType.Table || !contextMenu.rename || !contextMenu.table) {
    return null;
  }

  return (
    <PixiRename
      defaultValue={contextMenu.table.name}
      position={position}
      className="reverse-selection origin-bottom-left bg-primary px-3 text-sm font-bold text-primary-foreground"
      styles={{ fontSize: TABLE_NAME_FONT_SIZE, paddingLeft: TABLE_NAME_PADDING[0] }}
      onSave={(value: string) => {
        if (contextMenu.table && pixiApp.cellsSheets.current) {
          quadraticCore.dataTableMeta(
            pixiApp.cellsSheets.current?.sheetId,
            contextMenu.table.x,
            contextMenu.table.y,
            value,
            undefined,
            undefined,
            undefined,
            ''
          );
        }
      }}
      onClose={() => events.emit('contextMenu', {})}
      noScale
    />
  );
};
