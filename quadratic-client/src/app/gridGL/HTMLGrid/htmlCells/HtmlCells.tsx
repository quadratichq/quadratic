import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { useCallback } from 'react';
import './HtmlCells.css';

// parent of htmlCells. Handled in htmlCells.ts
export const HtmlCells = () => {
  const divRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      htmlCellsHandler.attach(node);
    } else {
      htmlCellsHandler.detach();
    }
  }, []);

  return (
    <div
      ref={divRef}
      className="dark-mode-hack"
      style={{
        pointerEvents: 'none',
      }}
    />
  );
};
