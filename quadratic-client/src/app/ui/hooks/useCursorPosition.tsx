import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { useEffect, useState } from 'react';

export const useCursorPosition = () => {
  const [cursorString, setCursorString] = useState('');

  useEffect(() => {
    const updateCursor = () => {
      const a1String = sheets.sheet.cursor.toA1String();
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

  return cursorString;
};
