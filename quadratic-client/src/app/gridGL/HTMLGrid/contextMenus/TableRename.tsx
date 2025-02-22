import { contextMenuAtom, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/TableName';
import { PixiRename } from '@/app/gridGL/HTMLGrid/contextMenus/PixiRename';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { useRenameTableName } from '@/app/ui/hooks/useRenameTableName';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const TableRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const [inputElement, setInputElement] = useState<HTMLInputElement | undefined>(undefined);
  const getInputElement = useCallback(
    (element: HTMLInputElement) => {
      setInputElement(element);
    },
    [setInputElement]
  );

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
        const bounds = pixiApp.cellsSheets.current?.tables.getTableNamePosition(
          contextMenu.table.x,
          contextMenu.table.y
        );
        if (bounds && inputElement) {
          setWidth(bounds.width);
          inputElement.style.top = `${bounds.y}px`;
          inputElement.style.left = `${bounds.x}px`;
          inputElement.style.height = `${bounds.height}px`;
        }
      }
    };
    updatePosition();
    events.on('viewportChanged', updatePosition);
    return () => {
      events.off('viewportChanged', updatePosition);
    };
  }, [contextMenu, inputElement]);

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
