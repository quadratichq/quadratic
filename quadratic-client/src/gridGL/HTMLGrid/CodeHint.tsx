import { sheets } from '@/grid/controller/Sheets';
import { useEffect, useMemo, useState } from 'react';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { Coordinate } from '../types/size';

export const CodeHint = () => {
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
      Press `=` to enter code
    </div>
  );
};
