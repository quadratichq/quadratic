import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';

export const HtmlCells = () => {
  const [htmlCells, setHtmlCells] = useState<JsHtmlOutput[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const htmlOutputRef = useRef<JsHtmlOutput[]>([]);

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
      container.style.transform = `matrix(${worldTransform.a}, ${worldTransform.b}, ${worldTransform.c}, ${worldTransform.d}, ${worldTransform.tx}, ${worldTransform.ty})`;
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

  let i = 0;
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
        ref={containerRef}
        style={{
          position: 'relative',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          border: '3px red solid',
        }}
      >
        {htmlCells.map((htmlCell) => {
          const offset = sheets.sheet.getCellOffsets(Number(htmlCell.x), Number(htmlCell.y));
          return (
            <iframe
              sandbox="allow-scripts allow-same-origin"
              srcDoc={htmlCell.html}
              title={`html-cell-${i}`}
              key={i++}
              style={{
                position: 'absolute',
                pointerEvents: 'auto',
                left: offset.x,
                top: offset.y + offset.height,
                width: '600px',
                height: '400px',
                background: 'white',
                border: '1px solid black',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
