import { cellTypeMenuOpenedCountAtom } from '@/atoms/cellTypeMenuOpenedCountAtom';
import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
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
    const updateCursor = async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      const newCellHasValue = await quadraticCore.hasRenderCells(sheets.sheet.id, x, y, 0, 0);
      setCellHasValue(newCellHasValue);
    };
    updateCursor();
    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
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
    events.on('cursorPosition', updateOffsets);
    events.on('changeSheet', updateOffsets);
    return () => {
      events.off('cursorPosition', updateOffsets);
      events.off('changeSheet', updateOffsets);
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
