import { useCallback, useEffect, useState } from 'react';
import './HtmlCells.css';
import { htmlCellsHandler } from './htmlCellsHandler';

// parent of htmlCells. Handled in htmlCells.ts
export const HtmlCells = () => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const divRef = useCallback((node: HTMLDivElement) => {
    setDiv(node);
    htmlCellsHandler.attach(node);
  }, []);

  useEffect(() => {
    htmlCellsHandler.init(div);
    return () => htmlCellsHandler.destroy();
  }, [div]);

  return (
    <div
      ref={divRef}
      style={{
        pointerEvents: 'none',
      }}
    />
  );
};
