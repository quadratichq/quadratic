/* eslint-disable @typescript-eslint/no-unused-vars */

import { sheets } from '@/app/grid/controller/Sheets';
import { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { ScrollBars } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBars';
import { LightWeightApp } from '@/app/gridGL/lightweightApp/LightWeightApp';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { selectionToSheetRect } from '@/app/quadratic-core/quadratic_core';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  height: number;
  a1: string;
}

export const AILightWeight = (props: Props) => {
  const [app, setApp] = useState<LightWeightApp | null>(null);
  const [rectangle, setRectangle] = useState<Rectangle | undefined>();
  const [maxSize, setMaxSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const htmlAnchorRef = useRef<HTMLDivElement>(null);
  const [hasHTML, setHasHTML] = useState(false);

  const ref = useCallback(
    (div: HTMLDivElement) => {
      if (!div) return;
      try {
        const selection = sheets.stringToSelection(props.a1, sheets.current);
        const tableNames = selection.getTableNames();
        if (tableNames.length > 0) {
          const table = pixiApp.cellsSheet().tables.getTableFromName(tableNames[0]);
          if (table?.codeCell.is_html) {
            const cell = htmlCellsHandler.findHtmlCellByName(table.codeCell.name);
            if (cell?.htmlCell) {
              const htmlCell = new HtmlCell(cell.htmlCell);
              if (htmlAnchorRef.current) {
                while (htmlAnchorRef.current.firstChild) {
                  htmlAnchorRef.current.removeChild(htmlAnchorRef.current.firstChild);
                }
                htmlAnchorRef.current.appendChild(htmlCell.iframe);
                htmlCell.iframe.style.pointerEvents = 'auto';
                setHasHTML(true);
                return;
              } else {
                throw new Error('htmlAnchorRef not found');
              }
            }
          }
        }
      } catch {}

      const app = new LightWeightApp(div);
      setApp(app);
      try {
        const range = selectionToSheetRect(sheets.current, props.a1, sheets.jsA1Context);
        const { width, height } = app.reposition(
          Number(range.min.x),
          Number(range.min.y),
          Number(range.max.x),
          Number(range.max.y)
        );
        setRectangle(
          new Rectangle(
            Number(range.min.x),
            Number(range.min.y),
            Number(range.max.x - range.min.x),
            Number(range.max.y - range.min.y)
          )
        );
        setMaxSize({ width: width, height: height });
      } catch {}
    },
    [props.a1]
  );

  useEffect(() => {
    return () => {
      if (app) {
        app.destroy();
      }
    };
  }, [app]);

  return (
    <div className="w-fit border">
      <div className="bold bg-blue-200 px-1">{props.a1}</div>
      <div
        ref={ref}
        className="relative"
        style={{
          // maxWidth: maxSize.maxWidth,
          width: hasHTML ? 'auto' : maxSize.width,
          // maxHeight: maxSize.maxHeight,
          height: hasHTML ? 'auto' : `min(${props.height}px, ${maxSize.height}px)`,
        }}
      >
        <div className="h-full w-full" style={{ display: hasHTML ? 'block' : 'none' }} ref={htmlAnchorRef} />
        {app && !hasHTML && <ScrollBars baseApp={app} rectangle={rectangle} />}
      </div>
    </div>
  );
};
