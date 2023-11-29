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
      // the first child is the right resize control, second is iframe, third is bottom resize control
      const iframe = div.childNodes[1] as HTMLIFrameElement;
      if (!iframe) return;

      const afterLoad = () => {
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

          // move margin to the div holding the iframe to avoid pinch-to-zoom issues at the iframe margins
          if (style.marginLeft) {
            div.style.paddingLeft = style.marginLeft;
            iframe.contentWindow.document.body.style.marginLeft = '0';
          }
          if (style.marginTop) {
            div.style.paddingTop = style.marginTop;
            iframe.contentWindow.document.body.style.marginTop = '0';
          }
          if (style.marginRight) {
            div.style.paddingRight = style.marginRight;
            iframe.contentWindow.document.body.style.marginRight = '0';
          }
          if (style.marginBottom) {
            div.style.paddingBottom = style.marginBottom;
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
      };

      if (iframe.contentWindow?.document.readyState === 'complete') {
        afterLoad();
      } else {
        iframe.addEventListener('load', afterLoad);
      }
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
        width={htmlCell.w ? htmlCell.w : ''}
        height={htmlCell.h ? htmlCell.h : ''}
        style={{
          minWidth: `${CELL_WIDTH}px`,
          minHeight: `${CELL_HEIGHT}px`,
        }}
      />
      <HTMLResizeControl position="BOTTOM" />
    </div>
  );
};
