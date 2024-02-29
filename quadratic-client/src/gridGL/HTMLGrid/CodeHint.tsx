import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { sheets } from '@/grid/controller/Sheets';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Rectangle } from 'pixi.js';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { Coordinate } from '../types/size';

export const useCellTypeMenuOpenedCount = () => {
  return useLocalStorage('cellTypeMenuOpenedCount', 0);
};

export const CodeHint = () => {
  const [cellHasValue, setCellHasValue] = useState(false);
  const [cellTypeMenuOpenedCount] = useCellTypeMenuOpenedCount();
  const { showCodeEditor } = useRecoilValue(editorInteractionStateAtom);

  useEffect(() => {
    const updateCursor = () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      const newCellHasValue = sheets.sheet.hasRenderCells(new Rectangle(x, y, 0, 0));
      setCellHasValue(newCellHasValue);
    };
    updateCursor();
    window.addEventListener('cursor-position', updateCursor);
    window.addEventListener('change-sheet', updateCursor);
    return () => {
      window.removeEventListener('cursor-position', updateCursor);
      window.removeEventListener('change-sheet', updateCursor);
    };
  }, []);

  if (cellHasValue || cellTypeMenuOpenedCount > 3 || showCodeEditor) {
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
      className="pointer-events-none absolute whitespace-nowrap bg-white pr-0.5 text-sm leading-3 text-muted-foreground"
      style={{
        left: offsets.x + CURSOR_THICKNESS,
        top: offsets.y + CURSOR_THICKNESS * 2,
      }}
    >
      Press '=' to code
    </div>
  );
};
