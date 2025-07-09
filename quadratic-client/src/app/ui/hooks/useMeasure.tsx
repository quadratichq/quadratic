import type { Size } from '@/app/shared/types/size';
import { useEffect, useState } from 'react';

// This hook measures the size of a component by creating a temporary DOM element
// with the same structure and styles, rather than trying to render a React element
export const useMeasure = (elementType: 'button' | 'div' | 'span', className?: string): Size => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Create a temporary element to measure
    const tempElement = document.createElement(elementType);

    // Apply the className if provided
    if (className) {
      tempElement.className = className;
    }

    // Position it off-screen
    tempElement.style.position = 'absolute';
    tempElement.style.left = '-10000px';
    tempElement.style.top = '-10000px';
    tempElement.style.visibility = 'hidden';
    tempElement.style.pointerEvents = 'none';

    // Add some content to ensure proper sizing
    tempElement.textContent = 'M';

    document.body.appendChild(tempElement);

    // Wait for the next frame to ensure the element is rendered
    requestAnimationFrame(() => {
      const { width, height } = tempElement.getBoundingClientRect();
      setSize({ width, height });

      // Cleanup
      document.body.removeChild(tempElement);
    });

    return () => {
      // Cleanup on unmount
      if (tempElement.parentNode) {
        document.body.removeChild(tempElement);
      }
    };
  }, [elementType, className]);

  return size;
};
