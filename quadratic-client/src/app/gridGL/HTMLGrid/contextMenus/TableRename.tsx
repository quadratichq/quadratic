import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { content } from '@/app/gridGL/pixiApp/Content';
import { useRenameTableName } from '@/app/ui/hooks/useRenameTableName';
import { LINE_HEIGHT, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { CELL_HEIGHT, DEFAULT_FONT_SIZE } from '@/shared/constants/gridConstants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const TableRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const inputRef = useRef<HTMLInputElement>(null);
  const getInputElement = useCallback((element: HTMLInputElement) => {
    inputRef.current = element;
  }, []);

  const [width, setWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const updatePosition = () => {
      if (
        contextMenu.type !== ContextMenuType.Table ||
        !contextMenu.rename ||
        !contextMenu.table ||
        contextMenu.selectedColumn !== undefined
      ) {
        return;
      } else {
        const bounds = content.cellsSheet.tables.getTableNamePosition(contextMenu.table.x, contextMenu.table.y);
        if (bounds && inputRef.current) {
          // Calculate vertical position to match TableName text positioning
          const textHeight = LINE_HEIGHT;
          const availableSpace = bounds.height - textHeight;
          const yPos = Math.max(0, availableSpace / 2);

          // Calculate symbol offset (same as TableName)
          const SYMBOL_SCALE = 0.5;
          const SYMBOL_PADDING = 5;
          const hasSymbol = contextMenu.table.is_code;
          const symbolWidth = hasSymbol ? CELL_HEIGHT * SYMBOL_SCALE : 0;
          const symbolOffset = hasSymbol ? SYMBOL_PADDING + symbolWidth : 0;

          setWidth(bounds.width);
          inputRef.current.style.top = `${bounds.y + OPEN_SANS_FIX.y + yPos}px`;
          inputRef.current.style.left = `${bounds.x + OPEN_SANS_FIX.x + symbolOffset}px`;
          inputRef.current.style.height = `${bounds.height}px`;
          inputRef.current.style.paddingLeft = '0';
          inputRef.current.style.paddingRight = '0';
        }
      }
    };
    updatePosition();
    events.on('viewportChanged', updatePosition);
    return () => {
      events.off('viewportChanged', updatePosition);
    };
  }, [contextMenu.rename, contextMenu.selectedColumn, contextMenu.table, contextMenu.type]);

  const { renameTable } = useRenameTableName();

  const handleSave = useCallback(
    (value: string) => {
      if (content.cellsSheets.current?.sheetId && contextMenu.table && contextMenu.table.name !== value) {
        renameTable({
          sheetId: content.cellsSheets.current?.sheetId,
          x: contextMenu.table.x,
          y: contextMenu.table.y,
          oldName: contextMenu.table.name,
          newName: value,
        });
      }
    },
    [contextMenu.table, renameTable]
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const value = input.value.replace(/ /g, '_').trim();
    input.value = value;
  }, []);

  if (contextMenu.type !== ContextMenuType.Table || !contextMenu.rename || !contextMenu.table) {
    return null;
  }

  return (
    <PixiRename
      defaultValue={contextMenu.table.name}
      initialValue={contextMenu.initialValue}
      width={width}
      className="reverse-selection origin-bottom-left bg-primary text-sm font-bold text-primary-foreground"
      styles={{
        fontFamily: 'OpenSans-Bold, sans-serif',
        fontSize: DEFAULT_FONT_SIZE,
      }}
      onSave={handleSave}
      onClose={() => events.emit('contextMenu', {})}
      onInput={handleInput}
      getElement={getInputElement}
    />
  );
};
