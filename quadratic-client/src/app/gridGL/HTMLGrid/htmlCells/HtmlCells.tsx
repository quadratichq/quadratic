import { useCallback, useEffect, useState } from 'react';

import '@/app/gridGL/HTMLGrid/htmlCells/HtmlCells.css';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';

// parent of htmlCells. Handled in htmlCells.ts
export const HtmlCells = () => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const divRef = useCallback((node: HTMLDivElement | null) => {
    setDiv(node);
    if (node) htmlCellsHandler.attach(node);
  }, []);

  useEffect(() => {
    htmlCellsHandler.init(div);
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
