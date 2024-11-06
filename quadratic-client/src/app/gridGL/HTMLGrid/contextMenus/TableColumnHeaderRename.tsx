import { getColumns } from '@/app/actions/dataTableSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FONT_SIZE } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const TableColumnHeaderRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const position = useMemo(() => {
    if (
      contextMenu.type !== ContextMenuType.TableColumn ||
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
    return contextMenu.table.columns[contextMenu.selectedColumn].name;
  }, [contextMenu.selectedColumn, contextMenu.table]);

  if (
    contextMenu.type !== ContextMenuType.TableColumn ||
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
        color: 'var(--table-column-header-foreground)',
        backgroundColor: 'var(--table-column-header-background)',
      }}
      onSave={(value: string) => {
        if (contextMenu.table && contextMenu.selectedColumn && pixiApp.cellsSheets.current) {
          const columns = getColumns();

          if (columns) {
            columns[contextMenu.selectedColumn].name = value;

            quadraticCore.dataTableMeta(
              pixiApp.cellsSheets.current?.sheetId,
              contextMenu.table.x,
              contextMenu.table.y,
              undefined,
              undefined,
              columns,
              undefined,
              ''
            );
          }
        }
      }}
      onClose={() => events.emit('contextMenu', {})}
    />
  );
};
