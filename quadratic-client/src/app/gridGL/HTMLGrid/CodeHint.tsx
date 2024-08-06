import { cellTypeMenuOpenedCountAtom } from '@/app/atoms/cellTypeMenuOpenedCountAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';
import { CURSOR_BORDER_SIZE } from '../UI/UIConstants';

export const CodeHint = () => {
  const [cellHasValue, setCellHasValue] = useState(false);
  const cellTypeMenuOpenedCount = useRecoilValue(cellTypeMenuOpenedCountAtom);
  const { showCodeEditor, permissions } = useRecoilValue(editorInteractionStateAtom);
  const { x: initialX, y: initialY } = sheets.sheet.cursor.cursorPosition;
  const [offsets, setOffsets] = useState(sheets.sheet.getCellOffsets(initialX, initialY));
  const [hide, setHide] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [multipleSelection, setMultipleSelection] = useState(false);

  useEffect(() => {
    const updateCursor = async () => {
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      const newCellHasValue = await quadraticCore.hasRenderCells(sheets.sheet.id, x, y, 1, 1);
      setHide(true);
      setCellHasValue(newCellHasValue);

      const offsets = sheets.sheet.getCellOffsets(x, y);
      if (ref.current && ref.current.offsetWidth < offsets.width - CURSOR_BORDER_SIZE * 2) {
        setOffsets(offsets);
        setHide(false);
      } else {
        setHide(true);
      }
      setOffsets(sheets.sheet.getCellOffsets(x, y));
      setMultipleSelection(
        sheets.sheet.cursor.multiCursor !== undefined || sheets.sheet.cursor.columnRow !== undefined
      );
    };
    updateCursor();
    events.on('setCursor', updateCursor);
    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    events.on('sheetOffsets', updateCursor);
    events.on('resizeHeadingColumn', updateCursor);
    events.on('resizeHeadingRow', updateCursor);
    events.on('resizeRowHeights', updateCursor);

    return () => {
      events.off('setCursor', updateCursor);
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
      events.off('sheetOffsets', updateCursor);
      events.off('resizeHeadingColumn', updateCursor);
      events.off('resizeHeadingRow', updateCursor);
      events.off('resizeRowHeights', updateCursor);
    };
  }, []);

  if (
    cellHasValue ||
    cellTypeMenuOpenedCount >= 2 ||
    showCodeEditor ||
    !permissions.includes('FILE_EDIT') ||
    isMobile ||
    multipleSelection
  ) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="center pointer-events-none absolute ml-1 whitespace-nowrap pr-0.5 text-xs leading-3 text-muted-foreground"
      style={{
        left: offsets.x + CURSOR_BORDER_SIZE,
        top: offsets.y + CURSOR_BORDER_SIZE * 2,
        visibility: hide ? 'hidden' : 'visible',
      }}
    >
      Press / to code
    </div>
  );
};
