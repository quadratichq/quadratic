import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/TableName';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useRenameTableName } from '@/app/ui/hooks/useRenameTableName';
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
        const bounds = pixiApp.cellsSheet().tables.getTableNamePosition(contextMenu.table.x, contextMenu.table.y);
        if (bounds && inputRef.current) {
          setWidth(bounds.width);
          inputRef.current.style.top = `${bounds.y}px`;
          inputRef.current.style.left = `${bounds.x}px`;
          inputRef.current.style.height = `${bounds.height}px`;
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
      if (pixiApp.cellsSheets.current?.sheetId && contextMenu.table && contextMenu.table.name !== value) {
        renameTable({
          sheetId: pixiApp.cellsSheets.current.sheetId,
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
      className="reverse-selection origin-bottom-left bg-primary px-3 text-sm font-bold text-primary-foreground"
      styles={{
        fontFamily: 'OpenSans-Bold, sans-serif',
        fontSize: TABLE_NAME_FONT_SIZE,
        paddingLeft: TABLE_NAME_PADDING[0],
      }}
      onSave={handleSave}
      onClose={() => events.emit('contextMenu', {})}
      onInput={handleInput}
      getElement={getInputElement}
    />
  );
};
