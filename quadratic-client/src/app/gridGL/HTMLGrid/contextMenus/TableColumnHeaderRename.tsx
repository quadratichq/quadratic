import { getColumns } from '@/app/actions/dataTableSpec';
import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useRenameTableColumnName } from '@/app/ui/hooks/useRenameTableColumnName';
import { FONT_SIZE } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const TableColumnHeaderRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const inputElement = useRef<HTMLInputElement | null>(null);

  const width = useMemo(() => {
    const tables = pixiApp.cellsSheets.current?.tables;
    if (!tables) {
      throw new Error('Tables not found in TableColumnHeaderRename');
    }
    if (!contextMenu.table || contextMenu.selectedColumn === undefined) return 0;
    const bounds = tables.getTableColumnHeaderPosition(
      contextMenu.table.x,
      contextMenu.table.y,
      contextMenu.selectedColumn
    );
    return bounds?.width ?? 0;
  }, [contextMenu.table, contextMenu.selectedColumn]);

  const updatePosition = useCallback(() => {
    if (
      contextMenu.type !== ContextMenuType.TableColumn ||
      !contextMenu.rename ||
      !contextMenu.table ||
      contextMenu.selectedColumn === undefined
    ) {
      return;
    } else {
      const tables = pixiApp.cellsSheets.current?.tables;
      if (!tables) {
        throw new Error('Tables not found in TableColumnHeaderRename');
      }
      const bounds = tables.getTableColumnHeaderPosition(
        contextMenu.table.x,
        contextMenu.table.y,
        contextMenu.selectedColumn
      );
      if (!bounds || !inputElement.current) return;
      inputElement.current.style.top = `${bounds.y - 1}px`;
      inputElement.current.style.left = `${bounds.x + 1}px`;
      inputElement.current.style.height = `${bounds.height}px`;
    }
  }, [contextMenu, inputElement]);

  const getInputElement = useCallback(
    (element: HTMLInputElement) => {
      inputElement.current = element;
      updatePosition();
    },
    [updatePosition]
  );

  useEffect(() => {
    updatePosition();
    events.on('viewportReadyAfterUpdate', updatePosition);
    return () => {
      events.off('viewportReadyAfterUpdate', updatePosition);
    };
  }, [updatePosition]);

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
              index: contextMenu.selectedColumn,
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
      defaultValue={defaultValue}
      initialValue={contextMenu.initialValue}
      width={width}
      className="darker-selection origin-bottom-left border-none p-0 text-sm font-bold text-primary-foreground outline-none"
      styles={{
        fontFamily: 'OpenSans-Bold, sans-serif',
        fontSize: FONT_SIZE,
        color: 'var(--primary-foreground)',
        backgroundColor: 'var(--accent)',
      }}
      onSave={handleSave}
      onClose={() => events.emit('contextMenu', {})}
      getElement={getInputElement}
    />
  );
};
