import { events } from '@/app/events/events';
import { useEffect, useState } from 'react';

export const useHeadingSize = (): { topHeading: number; leftHeading: number } => {
  const [topHeading, setTopHeading] = useState(0);
  const [leftHeading, setLeftHeading] = useState(0);
  useEffect(() => {
    const updateHeadingSize = (width: number, height: number) => {
      setLeftHeading(width);
      setTopHeading(height);
    };
    events.on('headingSize', updateHeadingSize);
    return () => {
      events.off('headingSize', updateHeadingSize);
    };
  }, []);

  return { topHeading, leftHeading };
};
