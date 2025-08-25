/* eslint-disable @typescript-eslint/no-unused-vars */

import { sheets } from '@/app/grid/controller/Sheets';
import { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { content } from '@/app/gridGL/pixiApp/Content';
import type { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { selectionToSheetRect } from '@/app/quadratic-core/quadratic_core';
import { Rectangle } from 'pixi.js';
import { useCallback, useRef, useState } from 'react';

const MAX_HEIGHT = '25vh';

interface Props {
  a1: string;
}

export const DataView = (props: Props) => {
  const [rectangle, setRectangle] = useState<Rectangle | undefined>();

  const anchorRef = useRef<HTMLDivElement>(null);
  const [hasHTML, setHasHTML] = useState(false);
  const htmlAnchorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [viewport, setViewport] = useState<Viewport | undefined>();

  const ref = useCallback(
    (div: HTMLDivElement) => {
      if (!div) return;
      try {
        const selection = sheets.stringToSelection(props.a1, sheets.current);
        const tableNames = selection.getTableNames();
        if (tableNames.length > 0) {
          const table = content.cellsSheet.tables.getTableFromName(tableNames[0]);
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

      try {
        const range = selectionToSheetRect(sheets.current, props.a1, sheets.jsA1Context);
        setRectangle(
          new Rectangle(
            Number(range.min.x),
            Number(range.min.y),
            Number(range.max.x - range.min.x),
            Number(range.max.y - range.min.y)
          )
        );
      } catch {}
    },
    [props.a1]
  );

  return (
    <div className="w-fit border">
      <div className="bold bg-blue-200 px-1">{props.a1}</div>
      <div
        ref={ref}
        className="relative"
        style={{
          // maxWidth: maxSize.maxWidth,
          width: hasHTML || !rectangle ? 'auto' : rectangle.width,
          // maxHeight: maxSize.maxHeight,
          height: hasHTML || !rectangle ? 'auto' : rectangle.height,
          maxHeight: MAX_HEIGHT,
        }}
      >
        <div className="h-full w-full" style={{ display: hasHTML ? 'block' : 'none' }} ref={anchorRef}>
          {hasHTML && <div className="h-full w-full" ref={htmlAnchorRef} />}
          {!hasHTML && <canvas className="h-full w-full" ref={canvasRef} />}
        </div>
      </div>
    </div>
  );
};
