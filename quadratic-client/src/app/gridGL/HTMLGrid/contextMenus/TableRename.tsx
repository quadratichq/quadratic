import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/TableName';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useRenameTableName } from '@/app/ui/hooks/useRenameTableName';
import type { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const TableRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const [position, setPosition] = useState<Rectangle | undefined>(undefined);
  useEffect(() => {
    const updatePosition = () => {
      if (
        contextMenu.type !== ContextMenuType.Table ||
        !contextMenu.rename ||
        !contextMenu.table ||
        contextMenu.selectedColumn !== undefined
      ) {
        setPosition(undefined);
      } else {
        setPosition(pixiApp.cellsSheets.current?.tables.getTableNamePosition(contextMenu.table.x, contextMenu.table.y));
      }
    };
    updatePosition();
    events.on('viewportChangedReady', updatePosition);
    return () => {
      events.off('viewportChangedReady', updatePosition);
    };
  }, [contextMenu]);

  const { renameTable } = useRenameTableName();

  const handleSave = useCallback(
    (value: string) => {
      if (pixiApp.cellsSheets.current?.sheetId && contextMenu.table && contextMenu.table.name !== value) {
        renameTable({
          sheetId: pixiApp.cellsSheets.current.sheetId,
          x: contextMenu.table.x,
          y: contextMenu.table.y,
          name: value,
        });
      }
    },
    [contextMenu.table, renameTable]
  );

  if (contextMenu.type !== ContextMenuType.Table || !contextMenu.rename || !contextMenu.table) {
    return null;
  }

  return (
    <PixiRename
      defaultValue={contextMenu.table.name}
      position={position}
      className="reverse-selection origin-bottom-left bg-primary px-3 text-sm font-bold text-primary-foreground"
      styles={{ fontSize: TABLE_NAME_FONT_SIZE, paddingLeft: TABLE_NAME_PADDING[0] }}
      onSave={handleSave}
      onClose={() => events.emit('contextMenu', {})}
      noShrink
    />
  );
};
