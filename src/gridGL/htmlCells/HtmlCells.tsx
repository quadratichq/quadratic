import { CELL_HEIGHT, CELL_WIDTH } from '@/constants/gridConstants';
import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';

export const HtmlCells = () => {
  const [htmlCells, setHtmlCells] = useState<JsHtmlOutput[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const htmlOutputRef = useRef<JsHtmlOutput[]>([]);

  const iframeRef = useCallback((node: HTMLIFrameElement | null) => {
    if (node) {
      node.addEventListener('load', () => {
        if (node.contentWindow) {
          const style = window.getComputedStyle(node.contentWindow.document.body);
          const dataSize = node.getAttribute('data-size');
          if (!dataSize) {
            throw new Error('Expected data-size attribute on iframe');
          }
          const size = dataSize.split(',');
          if (size[0] === '0') {
            node.width = (
              node.contentWindow.document.body.scrollWidth +
              parseInt(style.marginLeft, 10) +
              parseInt(style.marginRight, 10)
            ).toString();
          } else {
            node.width = size[0];
          }
          if (size[1] === '0') {
            node.height = (
              node.contentWindow.document.body.scrollHeight +
              parseInt(style.marginTop, 10) +
              parseInt(style.marginBottom, 10)
            ).toString();
          } else {
            node.height = size[1];
          }

          // prevent mouse/touch events from zooming the html page
          node.addEventListener('wheel', (event) => event.preventDefault());
        } else {
          throw new Error('Expected content window to be defined on iframe');
        }
      });
    }
  }, []);

  const handleHtmlCells = useCallback(() => {
    const htmlOutput = grid.getHtmlOutput(sheets.sheet.id);
    setHtmlCells(htmlOutput);
    htmlOutputRef.current = htmlOutput;
  }, []);

  useEffect(() => {
    const handleViewport = () => {
      const container = containerRef.current;
      if (!container) return;
      const viewport = pixiApp.viewport;

      viewport.updateTransform();
      const worldTransform = viewport.worldTransform;
      container.style.transform = `matrix(${worldTransform.a},${worldTransform.b},${worldTransform.c},${worldTransform.d},${worldTransform.tx},${worldTransform.ty})`;
    };

    handleViewport();
    pixiApp.viewport.on('moved', handleViewport);
    pixiApp.viewport.on('moved-end', handleViewport);

    return () => {
      pixiApp.viewport.off('moved', handleViewport);
      pixiApp.viewport.off('moved-end', handleViewport);
    };
  }, []);

  useEffect(() => {
    handleHtmlCells();
    window.addEventListener('change-sheet', handleHtmlCells);
    return () => window.removeEventListener('change-sheet', handleHtmlCells);
  }, [handleHtmlCells]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      <div
        className="html-cells"
        ref={containerRef}
        style={{
          position: 'relative',
          top: 3,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {htmlCells.map((htmlCell, index) => {
          const offset = sheets.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));
          return (
            <iframe
              ref={iframeRef}
              seamless
              srcDoc={htmlCell.html}
              title={`HTML from ${htmlCell.x}, ${htmlCell.y}}`}
              data-pos={`${htmlCell.x},${htmlCell.y}`}
              data-size={`${htmlCell.w},${htmlCell.h}`}
              key={index++}
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
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
