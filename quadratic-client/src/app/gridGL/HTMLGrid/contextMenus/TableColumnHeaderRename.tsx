import { getDisplayColumns } from '@/app/actions/dataTableSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { COLUMN_HEADER_BACKGROUND_LUMINOSITY } from '@/app/gridGL/cells/tables/TableColumnHeaders';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { cssVariableWithLuminosity } from '@/app/helpers/convertColor';
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
      hasBorder={2}
      defaultValue={originalHeaderName}
      position={position}
      className="darker-selection origin-bottom-left border-none p-0 text-sm font-bold text-primary-foreground outline-none"
      styles={{
        fontSize: FONT_SIZE,
        color: 'var(--primary-foreground)',
        backgroundColor: cssVariableWithLuminosity('primary', COLUMN_HEADER_BACKGROUND_LUMINOSITY),
      }}
      onSave={(value: string) => {
        if (contextMenu.table && contextMenu.selectedColumn !== undefined && pixiApp.cellsSheets.current) {
          const columns = getDisplayColumns();

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