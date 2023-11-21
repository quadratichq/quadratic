import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { useCallback } from 'react';

interface Props {
  htmlCell: JsHtmlOutput;
}

export const DivHtmlCell = (props: Props) => {
  const { htmlCell } = props;

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        node.style.width = htmlCell.w ? Number(htmlCell.w) + 'px' : '';
        node.style.height = htmlCell.h ? Number(htmlCell.h) + 'px' : '';
        node.innerHTML = htmlCell.html;

        // prevent mouse/touch events from zooming the html page
        node.addEventListener('wheel', (event) => event.preventDefault());
      }
    },
    [htmlCell.h, htmlCell.html, htmlCell.w]
  );

  const offset = sheets.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));

  return (
    <div
      ref={ref}
      title={`HTML from (${htmlCell.x}, ${htmlCell.y})`}
      // this is needed by HtmlCells.tsx
      data-sheet={htmlCell.sheet_id}
      // this is needed by PointerHtmlCells.ts
      data-pos={`${htmlCell.x},${htmlCell.y}`}
      style={{
        position: 'absolute',
        pointerEvents: 'auto',
        left: offset.x,
        top: offset.y + offset.height,
        // minWidth: `${CELL_WIDTH}px`,
        // minHeight: `${CELL_HEIGHT}px`,
        background: 'white',
        border: '1px solid black',
        boxSizing: 'border-box',
      }}
    />
  );
};
