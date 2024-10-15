/* eslint-disable @typescript-eslint/no-unused-vars */
//! This draws the table heading and provides its context menu.
//!
//! There are two overlays: the first is the active table that the sheet cursor
//! is in. The second is the table that the mouse is hovering over.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pixiApp } from '../../pixiApp/PixiApp';

export const TableOverlay = () => {
  const tableRef = useRef<HTMLDivElement>(null);
  const hoverTableRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    let tableTop = rect ? rect.y : 0;
    const checkViewport = () => {
      if (!rect || !tableRef.current) {
        return;
      }
      const viewport = pixiApp.viewport;
      const headingHeight = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
      if (rect.y < viewport.top + headingHeight) {
        tableTop = rect.y + (viewport.top + headingHeight - rect.y);
        tableRef.current.style.top = `${tableTop}px`;
      } else {
        tableRef.current.style.top = `${rect.y}px`;
      }
    };
    events.on('viewportChanged', checkViewport);
    return () => {
      events.off('viewportChanged', checkViewport);
    };
  }, [rect]);

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
          ref={tableRef}
          className="tables-overlay absolute"
          style={{
            left: rect.x,
            top: rect.y,
            transformOrigin: 'bottom left',
            transform: `translateY(-100%) scale(${1 / pixiApp.viewport.scale.x})`,
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
          ref={hoverTableRef}
          className="tables-overlay absolute"
          style={{
            left: hoverRect.x,
            top: hoverRect.y,
            transformOrigin: 'bottom left',
            transform: `translateY(-100%) scale(${1 / pixiApp.viewport.scale.x})`,
          }}
        >
          <div className="text-nowrap bg-primary px-1 text-sm text-primary-foreground">{hoverName}</div>
        </div>
      );
    }
  }, [hoverName, hoverRect, hoverTable]);

  useEffect(() => {
    const updateViewport = () => {
      if (table && tableRef.current) {
        tableRef.current.style.transform = `translateY(-100%) scale(${1 / pixiApp.viewport.scale.x})`;
      }
      if (hoverTable && hoverTableRef.current) {
        hoverTableRef.current.style.transform = `translateY(-100%) scale(${1 / pixiApp.viewport.scale.x})`;
      }
    };
    events.on('viewportChanged', updateViewport);
    return () => {
      events.off('viewportChanged', updateViewport);
    };
  }, [table, tableRef, hoverTable, hoverTableRef]);

  if (!tableRender && !hoverTableRender) return null;

  return (
    <>
      {tableRender}
      {hoverTable !== table && hoverTableRender}
    </>
  );
};
