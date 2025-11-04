import { tutorialAtom } from '@/app/atoms/tutorialAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { events } from '@/app/events/events';
import { rectangleSubtraction } from '@/app/gridGL/helpers/rectangleSubtraction';
import { useAtomValue } from 'jotai';
import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';

const Z_INDEX = 100;
const BACKGROUND_COLOR = 'rgba(0,0,0,0.2)';

export const MaskUI = () => {
  const { show, unmaskedElements } = useAtomValue(tutorialAtom);
  const [blockingRects, setBlockingRects] = useState<Rectangle[]>([]);
  const { debug } = useDebugFlags();

  // Block all keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      // If debug, allow through Cmd+R or Ctrl+R, otherwise block
      if (debug) {
        if (e.code === 'KeyR' && (e.metaKey || e.ctrlKey)) {
          return;
        }
      }
      if (e.code === 'Escape') {
        events.emit('tutorialTrigger', 'cancel');
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!show) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (!show) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('keypress', handleKeyPress, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('keypress', handleKeyPress, true);
    };
  }, [debug, show]);

  // Calculate blocking rectangles based on unmasked elements
  useEffect(() => {
    let retryTimeout: number | undefined;

    const calculateBlockingRects = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get all unmasked element rectangles
      const unmaskedRects: DOMRect[] = [];
      const missingElements: string[] = [];

      for (const id of unmaskedElements) {
        const element = document.getElementById(id);
        if (!element) {
          missingElements.push(id);
        } else {
          const rect = element.getBoundingClientRect();
          unmaskedRects.push(rect);
        }
      }

      // If some elements are missing, schedule a retry to find them
      if (missingElements.length > 0) {
        retryTimeout = window.setTimeout(calculateBlockingRects, 500);
      }

      if (unmaskedRects.length === 0) {
        // No unmasked elements found yet, block entire viewport
        setBlockingRects([new Rectangle(0, 0, viewportWidth, viewportHeight)]);
        return;
      }

      // Start with the full viewport as a single rectangle to be masked
      let maskedRects: Rectangle[] = [new Rectangle(0, 0, viewportWidth, viewportHeight)];

      // Subtract each unmasked element from all current masked rectangles
      for (const unmaskedRect of unmaskedRects) {
        const unmaskedRectangle = new Rectangle(
          unmaskedRect.left,
          unmaskedRect.top,
          unmaskedRect.width,
          unmaskedRect.height
        );

        // For each masked rectangle, subtract the unmasked area and collect the results
        const newMaskedRects: Rectangle[] = [];
        for (const maskedRect of maskedRects) {
          newMaskedRects.push(...rectangleSubtraction(maskedRect, unmaskedRectangle));
        }
        maskedRects = newMaskedRects;
      }

      setBlockingRects(maskedRects);
    };

    calculateBlockingRects();

    // Update on window resize or when unmasked elements change
    window.addEventListener('resize', calculateBlockingRects);
    window.addEventListener('scroll', calculateBlockingRects, true); // Use capture to catch all scroll events

    // Set up ResizeObserver to watch only the specific unmasked elements
    const resizeObserver = new ResizeObserver(calculateBlockingRects);

    unmaskedElements.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        resizeObserver.observe(element);
      }
    });

    return () => {
      if (retryTimeout !== undefined) {
        clearTimeout(retryTimeout);
      }
      window.removeEventListener('resize', calculateBlockingRects);
      window.removeEventListener('scroll', calculateBlockingRects, true);
      resizeObserver.disconnect();
    };
  }, [unmaskedElements]);

  if (!show) return null;
  return (
    <>
      {blockingRects.map((rect, index) => (
        <div
          key={index}
          style={{
            position: 'fixed',
            top: `${rect.y}px`,
            left: `${rect.x}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: BACKGROUND_COLOR,
            zIndex: Z_INDEX,
            cursor: 'default',
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      ))}
    </>
  );
};
