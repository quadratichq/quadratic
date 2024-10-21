import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { convertTintToHex } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { FONT_SIZE } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
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
      className="origin-bottom-left border-none p-0 text-sm font-bold text-primary-foreground outline-none"
      styles={{
        fontSize: FONT_SIZE,
        color: convertTintToHex(colors.tableColumnHeaderForeground),
        backgroundColor: convertTintToHex(colors.tableColumnHeaderBackground),
      }}
      onSave={() => {
        if (contextMenu.table) {
          console.log('TODO: rename column heading');
          // quadraticCore.renameDataTable(contextMenu.table.id, contextMenu.table.name);
        }
      }}
      onClose={() => events.emit('contextMenu', {})}
    />
  );
};
