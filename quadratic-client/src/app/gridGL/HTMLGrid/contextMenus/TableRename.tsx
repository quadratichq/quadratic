/* eslint-disable @typescript-eslint/no-unused-vars */

import { contextMenuAtom, ContextMenuSpecial, ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { TABLE_NAME_FONT_SIZE, TABLE_NAME_PADDING } from '@/app/gridGL/cells/tables/Table';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { FONT_SIZE } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { Input } from '@/shared/shadcn/ui/input';
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const TableRename = () => {
  const contextMenu = useRecoilValue(contextMenuAtom);

  const close = useCallback(() => {
    events.emit('contextMenu', {});
    focusGrid();
  }, []);

  const saveAndClose = useCallback(() => {
    if (contextMenu.table) {
      // quadraticCore.renameDataTable(contextMenu.table.id, contextMenu.table.name);
    }
    close();
  }, [contextMenu.table, close]);

  const ref = useRef<HTMLInputElement>(null);
  const position = useMemo(() => {
    if (
      contextMenu.type !== ContextMenuType.Table ||
      contextMenu.special !== ContextMenuSpecial.rename ||
      !contextMenu.table
    ) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const position = pixiApp.cellsSheets.current?.tables.getTableNamePosition(contextMenu.table.x, contextMenu.table.y);
    if (!position) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return position;
  }, [contextMenu]);

  // focus the input after the position is set
  useEffect(() => {
    if (position.height !== 0) {
      setTimeout(() => {
        if (ref.current) {
          ref.current.select();
          ref.current.focus();
        }
      }, 0);
    }
  }, [position]);

  useEffect(() => {
    const viewportChanged = () => {
      if (ref.current) {
        ref.current.style.transform = `scale(${1 / pixiApp.viewport.scaled})`;
      }
    };
    events.on('viewportChanged', viewportChanged);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        close();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        saveAndClose();
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [close, saveAndClose]
  );

  const onChange = useCallback(() => {
    if (ref.current) {
      // need to calculate the width of the input using a span with the same css as the input
      const span = document.createElement('span');
      span.className = 'text-sm px-3 w-full';
      span.style.fontSize = FONT_SIZE.toString();
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'pre';
      span.innerText = ref.current.value;
      document.body.appendChild(span);
      ref.current.style.width = `${span.offsetWidth}px`;
      document.body.removeChild(span);
    }
  }, []);

  if (
    contextMenu.type !== ContextMenuType.Table ||
    contextMenu.special !== ContextMenuSpecial.rename ||
    !contextMenu.table
  ) {
    return null;
  }

  return (
    <Input
      ref={ref}
      className="pointer-events-auto absolute rounded-none border-none bg-primary px-0 text-primary-foreground outline-none"
      style={{
        paddingLeft: TABLE_NAME_PADDING[0],
        left: position.x,
        top: position.y,
        fontSize: TABLE_NAME_FONT_SIZE,
        width: position.width,
        height: position.height,
        transformOrigin: 'bottom left',
        transform: `scale(${1 / pixiApp.viewport.scaled})`,
      }}
      onKeyDown={onKeyDown}
      onBlur={saveAndClose}
      onChange={onChange}
      defaultValue={contextMenu.table.name}
    />
  );
};
