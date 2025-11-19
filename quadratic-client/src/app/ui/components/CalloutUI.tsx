import { calloutAtom } from '@/app/atoms/calloutAtom';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';

const Z_INDEX = 101;
const POINTER_SIZE = 12;
const CALLOUT_PADDING = 0;
const CALLOUT_OFFSET = 5; // Distance from the target element
const FADE_IN_DELAY = 300; // Delay in milliseconds before callout fades in

interface CalloutPosition {
  id: string;
  top: number;
  left: number;
  pointerPosition: {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  };
  pointerStyle: 'top' | 'bottom' | 'left' | 'right';
}

export const CalloutUI = () => {
  const { callouts } = useAtomValue(calloutAtom);
  const [positions, setPositions] = useState<CalloutPosition[]>([]);
  const [visibleCallouts, setVisibleCallouts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (callouts.length === 0) {
      setPositions([]);
      setVisibleCallouts(new Set());
      return;
    }

    // Reset visible callouts when callouts change
    setVisibleCallouts(new Set());

    let retryTimeout: number | undefined;
    let fadeInTimeout: number | undefined;

    const calculatePositions = () => {
      const newPositions: CalloutPosition[] = [];
      const missingElements: string[] = [];

      for (const callout of callouts) {
        const element = document.getElementById(callout.id);
        if (!element) {
          missingElements.push(callout.id);
          continue;
        }

        const rect = element.getBoundingClientRect();
        const calloutElement = document.getElementById(`callout-${callout.id}`);
        const calloutWidth = calloutElement?.offsetWidth || 250;
        const calloutHeight = calloutElement?.offsetHeight || 100;

        let top = 0;
        let left = 0;
        let pointerPosition: CalloutPosition['pointerPosition'] = {};
        let pointerStyle: CalloutPosition['pointerStyle'] = callout.side;

        switch (callout.side) {
          case 'top':
            top = rect.top - calloutHeight - CALLOUT_OFFSET - POINTER_SIZE;
            left = rect.left + rect.width / 2 - calloutWidth / 2;
            pointerPosition = {
              bottom: -POINTER_SIZE,
              left: calloutWidth / 2 - POINTER_SIZE,
            };
            break;
          case 'bottom':
            top = rect.bottom + CALLOUT_OFFSET + POINTER_SIZE;
            left = rect.left + rect.width / 2 - calloutWidth / 2;
            pointerPosition = {
              top: -POINTER_SIZE,
              left: calloutWidth / 2 - POINTER_SIZE,
            };
            break;
          case 'left':
            top = rect.top + rect.height / 2 - calloutHeight / 2;
            left = rect.left - calloutWidth - CALLOUT_OFFSET - POINTER_SIZE;
            pointerPosition = {
              top: calloutHeight / 2 - POINTER_SIZE,
              right: -POINTER_SIZE,
            };
            break;
          case 'right':
            top = rect.top + rect.height / 2 - calloutHeight / 2;
            left = rect.right + CALLOUT_OFFSET + POINTER_SIZE;
            pointerPosition = {
              top: calloutHeight / 2 - POINTER_SIZE,
              left: -POINTER_SIZE,
            };
            break;
        }

        // Keep callout within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < CALLOUT_PADDING) {
          left = CALLOUT_PADDING;
        } else if (left + calloutWidth > viewportWidth - CALLOUT_PADDING) {
          left = viewportWidth - calloutWidth - CALLOUT_PADDING;
        }

        if (top < CALLOUT_PADDING) {
          top = CALLOUT_PADDING;
        } else if (top + calloutHeight > viewportHeight - CALLOUT_PADDING) {
          top = viewportHeight - calloutHeight - CALLOUT_PADDING;
        }

        newPositions.push({
          id: callout.id,
          top,
          left,
          pointerPosition,
          pointerStyle,
        });
      }

      // If we're expecting callouts but some elements are missing, retry
      if (callouts.length > 0 && missingElements.length > 0) {
        retryTimeout = window.setTimeout(calculatePositions, 500);
        return;
      }

      setPositions(newPositions);

      // Trigger fade-in after positions are set
      if (fadeInTimeout !== undefined) {
        clearTimeout(fadeInTimeout);
      }
      fadeInTimeout = window.setTimeout(() => {
        setVisibleCallouts(new Set(newPositions.map((p) => p.id)));
      }, FADE_IN_DELAY);
    };

    // Initial calculation
    calculatePositions();

    // Recalculate after a brief delay to ensure callout elements are rendered
    const initialTimeout = setTimeout(calculatePositions, 100);

    // Update on window resize or scroll
    window.addEventListener('resize', calculatePositions);
    window.addEventListener('scroll', calculatePositions, true);

    // Watch for changes to target elements
    const resizeObserver = new ResizeObserver(calculatePositions);
    callouts.forEach((callout) => {
      const element = document.getElementById(callout.id);
      if (element) {
        resizeObserver.observe(element);
      }
    });

    return () => {
      if (retryTimeout !== undefined) {
        clearTimeout(retryTimeout);
      }
      if (fadeInTimeout !== undefined) {
        clearTimeout(fadeInTimeout);
      }
      clearTimeout(initialTimeout);
      window.removeEventListener('resize', calculatePositions);
      window.removeEventListener('scroll', calculatePositions, true);
      resizeObserver.disconnect();
    };
  }, [callouts]);

  if (callouts.length === 0) return null;

  const getPointerStyle = (side: 'top' | 'bottom' | 'left' | 'right') => {
    const borderWidth = `${POINTER_SIZE}px`;
    const transparent = 'transparent';
    // Match pointer color to callout background
    const color = 'hsl(var(--foreground))';

    switch (side) {
      case 'top':
        return {
          borderLeft: `${borderWidth} solid ${transparent}`,
          borderRight: `${borderWidth} solid ${transparent}`,
          borderTop: `${borderWidth} solid ${color}`,
        };
      case 'bottom':
        return {
          borderLeft: `${borderWidth} solid ${transparent}`,
          borderRight: `${borderWidth} solid ${transparent}`,
          borderBottom: `${borderWidth} solid ${color}`,
        };
      case 'left':
        return {
          borderTop: `${borderWidth} solid ${transparent}`,
          borderBottom: `${borderWidth} solid ${transparent}`,
          borderLeft: `${borderWidth} solid ${color}`,
        };
      case 'right':
        return {
          borderTop: `${borderWidth} solid ${transparent}`,
          borderBottom: `${borderWidth} solid ${transparent}`,
          borderRight: `${borderWidth} solid ${color}`,
        };
    }
  };

  return (
    <>
      {callouts.map((callout) => {
        const position = positions.find((p) => p.id === callout.id);
        if (!position) return null;

        return (
          <div
            key={callout.id}
            id={`callout-${callout.id}`}
            className={`pointer-events-none fixed max-w-[300px] rounded-lg bg-foreground py-2 pl-3 pr-4 text-sm font-bold leading-[1.5] text-background shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-opacity duration-300 ease-in-out`}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              opacity: visibleCallouts.has(callout.id) ? 1 : 0,
              zIndex: Z_INDEX,
            }}
          >
            {callout.text}
            {/* Pointer/Arrow */}
            <div
              style={{
                position: 'absolute',
                width: 0,
                height: 0,
                ...position.pointerPosition,
                ...getPointerStyle(position.pointerStyle),
              }}
            />
          </div>
        );
      })}
    </>
  );
};
