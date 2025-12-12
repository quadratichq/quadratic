import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { events } from '@/app/events/events';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { getVisibleLeftColumn, getVisibleTopRow } from '@/app/gridGL/interaction/viewportHelper';
import { useFloatingDebugPosition } from '@/app/ui/components/useFloatingDebugPosition';
import { memo, useEffect, useState } from 'react';

export const FloatingTopLeftPosition = memo(() => {
  const { debugFlags } = useDebugFlags();
  const { leftHeading } = useHeadingSize();
  const bottomRem = useFloatingDebugPosition(1);
  const [topRow, setTopRow] = useState(0);
  const [leftColumn, setLeftColumn] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      setTopRow(getVisibleTopRow());
      setLeftColumn(getVisibleLeftColumn());
    };

    updatePosition();
    events.on('viewportChanged', updatePosition);
    return () => {
      events.off('viewportChanged', updatePosition);
    };
  }, []);

  if (!debugFlags.getFlag('debugShowTopLeftPosition')) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-50 flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.5)] px-3 py-1.5 text-xs text-muted-foreground shadow-md"
      style={{ left: `${leftHeading + 5}px`, bottom: `${bottomRem * 0.25}rem` }}
      data-testid="top-left-position"
    >
      Top-left: ({leftColumn}, {topRow})
    </div>
  );
});
