import { tutorialAtom } from '@/app/atoms/tutorialAtom';
import { rectangleSubtraction } from '@/app/gridGL/helpers/rectangleSubtraction';
import { useAtomValue, useSetAtom } from 'jotai';
import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';

const Z_INDEX = 100;
const BACKGROUND_COLOR = 'rgba(0,0,0,0.15)';

export const MaskUI = () => {
  const { show, unmaskedElements } = useAtomValue(tutorialAtom);
  const [blockingRects, setBlockingRects] = useState<Rectangle[]>([]);

  // Debug only - remove after testing
  const setUnmaskedElements = useSetAtom(tutorialAtom);
  useEffect(() => {
    setTimeout(
      () => setUnmaskedElements({ show: true, unmaskedElements: ['onboarding-checklist', 'show-ai-analyst'] }),
      2000
    );
  }, [setUnmaskedElements]);

  useEffect(() => {
    // Block all keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyPress = (e: KeyboardEvent) => {
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
  }, []);

  // Calculate blocking rectangles based on unmasked elements
  useEffect(() => {
    const calculateBlockingRects = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get all unmasked element rectangles
      const unmaskedRects = unmaskedElements
        .map((id) => {
          const element = document.getElementById(id);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return rect;
        })
        .filter((rect): rect is DOMRect => rect !== null);

      if (unmaskedRects.length === 0) {
        // No unmasked elements, block entire viewport
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
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseUp={(e) => {
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
