import { useEvents } from '@/app/events/useEvents';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useEffect } from 'react';

export const Events = () => {
  useEvents();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        if (e.target && e.target instanceof Element && !e.target.closest('#quadratic-ui')) {
          focusGrid();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
};
