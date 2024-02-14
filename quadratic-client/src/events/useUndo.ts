import { events } from '@/events/events';
import { useEffect, useState } from 'react';

export const useUndo = () => {
  const [hasUndo, setHasUndo] = useState(false);
  const [hasRedo, setHasRedo] = useState(false);

  useEffect(() => {
    events.on('undoRedo', ({ undo, redo }) => {
      setHasUndo(undo);
      setHasRedo(redo);
    });
  }, []);

  return { hasUndo, hasRedo };
};
