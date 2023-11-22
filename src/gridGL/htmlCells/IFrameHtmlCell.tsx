import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { useCallback } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { Wheel } from '../pixiOverride/Wheel';

interface Props {
  htmlCell: JsHtmlOutput;
}

export const IFrameHtmlCell = (props: Props) => {
  const { htmlCell } = props;

  const iframeRef = useCallback(
    (node: HTMLIFrameElement | null) => {
      if (node) {
        node.addEventListener('load', () => {
          if (node.contentWindow) {
            // turn off zooming within the iframe
            node.contentWindow.document.body.style.touchAction = 'none pan-x pan-y';

            // forward the wheel event to the pixi viewport and adjust its position
            node.contentWindow.document.body.addEventListener(
              'wheel',
              (event) => {
                const viewport = pixiApp.viewport;
                const wheel = viewport.plugins.get('wheel') as Wheel | null;
                if (!wheel) {
                  throw new Error('Expected wheel plugin to be defined on viewport');
                }
                const bounding = node.getBoundingClientRect();
                wheel.wheel(event, { x: bounding.left, y: bounding.top });
                event.stopPropagation();
                event.preventDefault();
              },
              { passive: false }
            );
            const style = window.getComputedStyle(node.contentWindow.document.body);
            if (!htmlCell.w) {
              node.width = (
                node.contentWindow.document.body.scrollWidth +
                parseInt(style.marginLeft, 10) +
                parseInt(style.marginRight, 10)
              ).toString();
            } else {
              node.width = htmlCell.w.toString();
            }
            if (!htmlCell.h) {
              node.height = (
                node.contentWindow.document.body.scrollHeight +
                parseInt(style.marginTop, 10) +
                parseInt(style.marginBottom, 10)
              ).toString();
            } else {
              node.height = htmlCell.h.toString();
            }
          } else {
            throw new Error('Expected content window to be defined on iframe');
          }
        });
      }
    },
    [htmlCell.h, htmlCell.w]
  );

  const offset = sheets.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));

  return (
    <iframe
      ref={iframeRef}
      seamless
      srcDoc={htmlCell.html}
      // this is needed by HtmlCells.tsx
      data-sheet={htmlCell.sheet_id}
      // this is needed by PointerHtmlCells.ts
      data-pos={`${htmlCell.x},${htmlCell.y}`}
      title={`HTML from ${htmlCell.x}, ${htmlCell.y}}`}
      width={htmlCell.w ? Number(htmlCell.w) : ''}
      height={htmlCell.h ? Number(htmlCell.h) : ''}
      style={{
        position: 'absolute',
        pointerEvents: 'auto',
        left: offset.x,
        top: offset.y + offset.height,
        minWidth: `${CELL_WIDTH}px`,
        minHeight: `${CELL_HEIGHT}px`,
        background: 'white',
        border: '1px solid black',
        boxSizing: 'border-box',
        touchAction: 'none pan-x pan-y',
      }}
    />
  );
};
