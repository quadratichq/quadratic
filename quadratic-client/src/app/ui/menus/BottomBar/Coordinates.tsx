import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { useFloatingDebugPosition } from '@/app/ui/components/useFloatingDebugPosition';
import { memo, useEffect, useState } from 'react';

export const Coordinates = memo(() => {
  const { debugFlags } = useDebugFlags();
  const { leftHeading } = useHeadingSize();
  const bottomRem = useFloatingDebugPosition(2);
  const [coordinates, setCoordinates] = useState('');

  useEffect(() => {
    if (!debugFlags.getFlag('debugShowCoordinates')) {
      return;
    }

    const updateCoordinates = (e: PointerEvent) => {
      setCoordinates(`${Math.round(e.clientX)},${Math.round(e.clientY)}`);
    };
    window.addEventListener('pointermove', updateCoordinates);
    return () => {
      window.removeEventListener('pointermove', updateCoordinates);
    };
  }, [debugFlags]);

  if (!debugFlags.getFlag('debugShowCoordinates')) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-50 flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.5)] px-3 py-1.5 text-xs text-muted-foreground shadow-md"
      style={{ left: `${leftHeading + 5}px`, bottom: `${bottomRem * 0.25}rem` }}
      data-testid="viewport-coordinates"
    >
      {coordinates}
    </div>
  );
});
