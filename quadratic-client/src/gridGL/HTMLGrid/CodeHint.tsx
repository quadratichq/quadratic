import { cellTypeMenuOpenedCountAtom } from '@/atoms/cellTypeMenuOpenedCountAtom';
import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { useEffect, useMemo, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';
import { CURSOR_THICKNESS } from '../UI/Cursor';
import { Coordinate } from '../types/size';

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
  const [hint, setHint] = useState<Coordinate>(sheets.sheet.cursor.cursorPosition);

  useEffect(() => {
    const updateCursor = () => {
      const cursor = sheets.sheet.cursor.cursorPosition;
      setHint(cursor);
    };
    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
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
      Press '/' to code
    </div>
  );
};
