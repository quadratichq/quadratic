import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { DivHtmlCell } from './DivHtmlCell';
import { IFrameHtmlCell } from './IFrameHtmlCell';

export const TOP_HTML_MARGIN = 0;

export const HtmlCells = () => {
  const [htmlCells, setHtmlCells] = useState<JsHtmlOutput[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleHtmlCells = useCallback(() => {
    const output: JsHtmlOutput[] = [];
    sheets.forEach((sheet) => {
      output.push(...grid.getHtmlOutput(sheet.id));
    });
    setHtmlCells(output);
    pixiApp.htmlPlaceholders.setHtmlCells(output);
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
    pixiApp.viewport.on('zoomed', handleViewport);

    return () => {
      pixiApp.viewport.off('moved', handleViewport);
      pixiApp.viewport.off('moved-end', handleViewport);
      pixiApp.viewport.on('zoomed', handleViewport);
    };
  }, []);

  const changeSheet = () => {
    if (containerRef.current) {
      containerRef.current.childNodes.forEach((child) => {
        const element = child as HTMLElement;
        const sheetId = element.getAttribute('data-sheet');

        // need to use visibility so HtmlPlaceholders can find the size of the element
        element.style.visibility = sheets.sheet.id === sheetId ? 'visible' : 'hidden';
      });
    }
  };

  useEffect(() => {
    const updateHtmlCells = (e: any) => {
      setHtmlCells((output) => {
        const sheets = e.detail;
        sheets.forEach((sheet: { id: string }) => {
          output = output.filter((htmlCell) => htmlCell.sheet_id !== sheet.id);
          output.push(...grid.getHtmlOutput(sheet.id));
        });
        pixiApp.htmlPlaceholders.setHtmlCells(output);
        return output;
      });
    };
    window.addEventListener('html-update', updateHtmlCells);
    return () => window.removeEventListener('html-update', updateHtmlCells);
  }, []);

  useEffect(() => {
    handleHtmlCells();
    window.addEventListener('change-sheet', changeSheet);
    return () => window.removeEventListener('change-sheet', changeSheet);
  }, [handleHtmlCells]);

  useEffect(() => {
    changeSheet();
  }, [htmlCells]);

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
          top: TOP_HTML_MARGIN,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {htmlCells.map((htmlCell) => {
          const key = `${htmlCell.sheet_id}!${htmlCell.x},${htmlCell.y}`;
          const html = '<html>';
          if (htmlCell.html.substring(0, html.length).toLowerCase() === html) {
            return <IFrameHtmlCell htmlCell={htmlCell} key={key} />;
          } else {
            return <DivHtmlCell htmlCell={htmlCell} key={key} />;
          }
        })}
      </div>
    </div>
  );
};
