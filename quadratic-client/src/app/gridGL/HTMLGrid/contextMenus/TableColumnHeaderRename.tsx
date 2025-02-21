import { getColumns } from '@/app/actions/dataTableSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useRenameTableColumnName } from '@/app/ui/hooks/useRenameTableColumnName';
import { FONT_SIZE } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import type { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const TableColumnHeaderRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const [position, setPosition] = useState<Rectangle | undefined>(undefined);
  useEffect(() => {
    const updatePosition = () => {
      if (
        contextMenu.type !== ContextMenuType.TableColumn ||
        !contextMenu.rename ||
        !contextMenu.table ||
        contextMenu.selectedColumn === undefined
      ) {
        setPosition(undefined);
      } else {
        setPosition(
          pixiApp.cellsSheets.current?.tables.getTableColumnHeaderPosition(
            contextMenu.table.x,
            contextMenu.table.y,
            contextMenu.selectedColumn
          )
        );
      }
    };
    updatePosition();
    events.on('viewportChangedReady', updatePosition);
    return () => {
      events.off('viewportChangedReady', updatePosition);
    };
  }, [contextMenu]);

  const { renameTableColumnHeader } = useRenameTableColumnName();

  const handleSave = useCallback(
    (value: string) => {
      if (contextMenu.table && contextMenu.selectedColumn !== undefined && pixiApp.cellsSheets.current) {
        const columns = getColumns();
        if (columns) {
          value = value.trim();

          const column = columns.find((c) => c.valueIndex === contextMenu.selectedColumn);
          if (column) {
            const oldColumnName = column.name;
            column.name = value;

            renameTableColumnHeader({
              sheetId: pixiApp.cellsSheets.current?.sheetId,
              x: contextMenu.table.x,
              y: contextMenu.table.y,
              tableName: contextMenu.table.name,
              oldColumnName,
              newColumnName: value,
              columns,
            });
          }
        }
      }
    },
    [contextMenu.selectedColumn, contextMenu.table, renameTableColumnHeader]
  );

  const defaultValue = useMemo(() => {
    if (!contextMenu.table || contextMenu.selectedColumn === undefined) {
      return;
    }

    return contextMenu.table.columns[contextMenu.selectedColumn].name;
  }, [contextMenu.selectedColumn, contextMenu.table]);

  const selectOnFocus = useMemo(() => {
    return contextMenu.initialValue === undefined;
  }, [contextMenu.initialValue]);

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
      defaultValue={defaultValue}
      initialValue={contextMenu.initialValue}
      position={position}
      className="darker-selection origin-bottom-left border-none p-0 text-sm font-bold text-primary-foreground outline-none"
      styles={{
        fontFamily: 'OpenSans-Bold, sans-serif',
        fontSize: FONT_SIZE,
        color: 'var(--primary-foreground)',
        backgroundColor: 'var(--accent)',
      }}
      onSave={handleSave}
      onClose={() => events.emit('contextMenu', {})}
      selectOnFocus={selectOnFocus}
    />
  );
};
