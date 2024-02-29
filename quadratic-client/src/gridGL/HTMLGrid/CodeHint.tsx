import { sheets } from '@/grid/controller/Sheets';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useEffect, useMemo, useState } from 'react';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { Coordinate } from '../types/size';

export const useCellTypeMenuOpenedCount = () => {
  return useLocalStorage('cellTypeMenuOpenedCount', 0);
};

export const CodeHint = () => {
  const [cellTypeMenuOpenedCount] = useCellTypeMenuOpenedCount();

  if (cellTypeMenuOpenedCount > 3) {
    return null;
  }

  return <CodeHintInternal />;
};

export const CodeHintInternal = () => {
  const [hint, setHint] = useState<Coordinate>(sheets.sheet.cursor.cursorPosition);

  useEffect(() => {
    const updateCursor = () => {
      const cursor = sheets.sheet.cursor.cursorPosition;
      setHint(cursor);
    };
    window.addEventListener('cursor-position', updateCursor);
    window.addEventListener('change-sheet', updateCursor);
    return () => {
      window.removeEventListener('cursor-position', updateCursor);
    };
  });

  const offsets = useMemo(() => {
    return sheets.sheet.getCellOffsets(hint.x, hint.y);
  }, [hint]);

  return (
    <div
      style={{
        position: 'absolute',
        left: offsets.x + CURSOR_THICKNESS,
        top: offsets.y,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        opacity: 0.5,
        fontSize: '14px',
      }}
    >
      Press '=' to code
    </div>
  );
};
