import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { useEffect, useState } from 'react';

export const CurrentSheetNameDisplay = () => {
  const [currentSheetName, setCurrentSheetName] = useState(sheets.sheet.name);

  useEffect(() => {
    const updateCurrentSheetName = () => {
      setCurrentSheetName(sheets.sheet.name);
    };

    events.on('changeSheet', updateCurrentSheetName);
    return () => {
      events.off('changeSheet', updateCurrentSheetName);
    };
  }, []);

  return <span className="truncate">{currentSheetName}</span>;
};
