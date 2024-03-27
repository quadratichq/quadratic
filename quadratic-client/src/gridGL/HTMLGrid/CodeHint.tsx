import { cellTypeMenuOpenedCountAtom } from '@/atoms/cellTypeMenuOpenedCountAtom';
import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { sheets } from '@/grid/controller/Sheets';
import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { ResizeHeadingColumnEvent } from '../interaction/pointer/PointerHeading';

export const CodeHint = () => {
  const [cellHasValue, setCellHasValue] = useState(false);
  const cellTypeMenuOpenedCount = useRecoilValue(cellTypeMenuOpenedCountAtom);
  const { showCodeEditor, permissions } = useRecoilValue(editorInteractionStateAtom);

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

  if (
    cellHasValue ||
    cellTypeMenuOpenedCount >= 2 ||
    showCodeEditor ||
    !permissions.includes('FILE_EDIT') ||
    isMobile
  ) {
    return null;
  }

  return <CodeHintInternal />;
};

export const CodeHintInternal = () => {
  const { x: initialX, y: initialY } = sheets.sheet.cursor.cursorPosition;
  const [offsets, setOffsets] = useState(sheets.sheet.getCellOffsets(initialX, initialY));

  useEffect(() => {
    const updateOffsets = () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      setOffsets(sheets.sheet.getCellOffsets(x, y));
    };

    window.addEventListener('cursor-position', updateOffsets);
    window.addEventListener('change-sheet', updateOffsets);
    return () => {
      window.removeEventListener('cursor-position', updateOffsets);
      window.removeEventListener('change-sheet', updateOffsets);
    };
  });

  useEffect(() => {
    const updateOffsets = (e: Event) => {
      const customEvent = e as ResizeHeadingColumnEvent;
      const column = customEvent.detail;
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      // Only update the state if the column being resized is one to the left of
      // where the cursor is
      if (x - 1 === column) {
        setOffsets(sheets.sheet.getCellOffsets(x, y));
      }
    };

    window.addEventListener('resize-heading-column', updateOffsets);
    return () => {
      window.removeEventListener('resize-heading-column', updateOffsets);
    };
  });

  return (
    <div
      className="pointer-events-none absolute whitespace-nowrap bg-white pr-0.5 text-sm leading-3 text-muted-foreground"
      style={{
        left: offsets.x + CURSOR_THICKNESS,
        top: offsets.y + CURSOR_THICKNESS * 2,
      }}
    >
      Press '/' to code
    </div>
  );
};
