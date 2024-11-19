import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { useEffect, useState } from 'react';

export const CursorSelectionDisplay = () => {
  const [cursorString, setCursorString] = useState('');

  useEffect(() => {
    const updateCursor = () => {
      const a1String = sheets.sheet.cursor.selection.toString(sheets.sheet.id, sheets.getRustSheetMap());
      setCursorString(a1String);
    };
    updateCursor();

    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
    };
  }, []);

  return <span className="truncate">{cursorString}</span>;
};
