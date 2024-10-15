//! This draws the table heading and provides its context menu.
//!
//! There are two overlays: the first is the active table that the sheet cursor
//! is in. The second is the table that the mouse is hovering over.

import { useEffect, useMemo, useState } from 'react';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { events } from '@/app/events/events';
import { Rectangle } from 'pixi.js';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '../../pixiApp/PixiApp';

export const TableOverlay = () => {
  const [table, setTable] = useState<JsRenderCodeCell | undefined>(undefined);
  const [rect, setRect] = useState<Rectangle | undefined>(undefined);
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const check = () => {
      const cursor = sheets.sheet.cursor.cursorPosition;
      let checkTable = pixiApp.cellsSheets.current?.cellsArray.getTableCursor(cursor);
      setTable(checkTable);
      if (checkTable) {
        const sheet = sheets.sheet;
        const rect = sheet.getScreenRectangle(checkTable.x, checkTable.y, checkTable.w, checkTable.h);
        setRect(rect);
        setName(checkTable.name);
      } else {
        setRect(undefined);
        setName(undefined);
      }
    };
    events.on('cursorPosition', check);
    return () => {
      events.off('cursorPosition', check);
    };
  }, []);

  const [hoverTable, setHoverTable] = useState<JsRenderCodeCell | undefined>(undefined);
  const [hoverRect, setHoverRect] = useState<Rectangle | undefined>(undefined);
  const [hoverName, setHoverName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const set = (checkTable?: JsRenderCodeCell) => {
      setHoverTable(checkTable);
      if (checkTable) {
        const sheet = sheets.sheet;
        const rect = sheet.getScreenRectangle(checkTable.x, checkTable.y, checkTable.w, checkTable.h);
        setHoverRect(rect);
        setHoverName(checkTable.name);
      } else {
        setHoverRect(undefined);
        setHoverName(undefined);
      }
    };
    events.on('hoverTable', set);
    return () => {
      events.off('hoverTable', set);
    };
  }, [table]);

  const tableRender = useMemo(() => {
    if (table && rect && name !== undefined) {
      return (
        <div
          className="tables-overlay absolute"
          style={{
            left: rect.x,
            top: rect.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="text-nowrap bg-primary px-1 text-sm text-primary-foreground">{name}</div>
        </div>
      );
    }
  }, [name, rect, table]);

  const hoverTableRender = useMemo(() => {
    if (hoverTable && hoverRect && hoverName !== undefined) {
      return (
        <div
          className="tables-overlay absolute"
          style={{
            left: hoverRect.x,
            top: hoverRect.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="text-nowrap bg-primary px-1 text-sm text-primary-foreground">{hoverName}</div>
        </div>
      );
    }
  }, [hoverName, hoverRect, hoverTable]);

  console.log(table, hoverTable);

  if (!tableRender && !hoverTableRender) return null;

  return (
    <>
      {tableRender}
      {hoverTable !== table && hoverTableRender}
    </>
  );
};
