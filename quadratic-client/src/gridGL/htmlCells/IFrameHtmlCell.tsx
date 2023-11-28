import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { colors } from '@/theme/colors';
import { useCallback } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { Wheel } from '../pixiOverride/Wheel';
import { HTMLResizeControl } from './HTMLResizeControl';

interface Props {
  htmlCell: JsHtmlOutput;
}

export const IFrameHtmlCell = (props: Props) => {
  const { htmlCell } = props;

  const divRef = useCallback(
    (div: HTMLDivElement | null) => {
      if (!div) return;
      const iframe = div.childNodes[0] as HTMLIFrameElement;
      if (!iframe) return;

      iframe.addEventListener('load', () => {
        if (iframe.contentWindow) {
          // turn off zooming within the iframe
          iframe.contentWindow.document.body.style.touchAction = 'none pan-x pan-y';

          // forward the wheel event to the pixi viewport and adjust its position
          iframe.contentWindow.document.body.addEventListener(
            'wheel',
            (event) => {
              const viewport = pixiApp.viewport;
              const wheel = viewport.plugins.get('wheel') as Wheel | null;
              if (!wheel) {
                throw new Error('Expected wheel plugin to be defined on viewport');
              }
              const bounding = iframe.getBoundingClientRect();
              wheel.wheel(event, {
                x: bounding.left + event.clientX * viewport.scale.x - event.clientX,
                y: bounding.top + event.clientY * viewport.scale.y - event.clientY,
              });
              event.stopPropagation();
              event.preventDefault();
            },
            { passive: false }
          );
          const style = window.getComputedStyle(iframe.contentWindow.document.body);

          // move margin to the div holding the iframe to avoid pinch-to-zoom issues
          if (style.marginLeft) {
            div.style.marginLeft = style.marginLeft;
            iframe.contentWindow.document.body.style.marginLeft = '0';
          }
          if (style.marginTop) {
            div.style.marginTop = style.marginTop;
            iframe.contentWindow.document.body.style.marginTop = '0';
          }
          if (style.marginRight) {
            div.style.marginRight = style.marginRight;
            iframe.contentWindow.document.body.style.marginRight = '0';
          }
          if (style.marginBottom) {
            div.style.marginBottom = style.marginBottom;
            iframe.contentWindow.document.body.style.marginBottom = '0';
          }

          if (!htmlCell.w) {
            iframe.width = (
              iframe.contentWindow.document.body.scrollWidth +
              parseInt(style.marginLeft, 10) +
              parseInt(style.marginRight, 10)
            ).toString();
          } else {
            iframe.width = htmlCell.w.toString();
          }
          if (!htmlCell.h) {
            iframe.height = (
              iframe.contentWindow.document.body.scrollHeight +
              parseInt(style.marginTop, 10) +
              parseInt(style.marginBottom, 10)
            ).toString();
          } else {
            iframe.height = htmlCell.h.toString();
          }
        } else {
          throw new Error('Expected content window to be defined on iframe');
        }
      });
    },
    [htmlCell.h, htmlCell.w]
  );

  const offset = sheets.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));

  return (
    <div
      ref={divRef}
      // this is needed by HtmlCells.tsx
      data-sheet={htmlCell.sheet_id}
      // these are needed by PointerHtmlCells.ts
      data-pos={`${htmlCell.x},${htmlCell.y}`}
      data-type="iframe"
      className={`bg-white`}
      style={{
        border: `1px solid ${colors.cellColorUserPythonRgba}`,
        position: 'absolute',
        left: offset.x - 0.5, // the 0.5 is adjustment for the border
        top: offset.y + offset.height - 0.5, // the 0.5 is adjustment for the border
        boxSizing: 'border-box',
        touchAction: 'none pan-x pan-y',
      }}
    >
      <HTMLResizeControl position="RIGHT" />
      <iframe
        seamless
        srcDoc={htmlCell.html}
        title={`HTML from ${htmlCell.x}, ${htmlCell.y}}`}
        width={htmlCell.w ? Number(htmlCell.w) : ''}
        height={htmlCell.h ? Number(htmlCell.h) : ''}
        style={{
          minWidth: `${CELL_WIDTH}px`,
          minHeight: `${CELL_HEIGHT}px`,
        }}
      />
      <HTMLResizeControl position="BOTTOM" />
    </div>
  );
};
