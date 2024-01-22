import { useEffect, useState } from 'react';

type Dimension = "width" | "height";

const isLargerThan = (dimension: Dimension, value: number) => {
  if (dimension === 'height') {
    return () => window.innerHeight >= value
  } else {
    return () => window.innerWidth >= value
  }
}

export const useWindowsSizeGreaterThan = (dimension: Dimension, pixels: number) => {
  const sizeCheck = isLargerThan(dimension, pixels);
  const [isLarger, setIsLarger] = useState(sizeCheck());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        let newValue = sizeCheck();
        if (isLarger !== newValue) {
          setIsLarger(newValue)
        }
      }

      window.addEventListener("resize", handleResize, { passive: true });
      return () => window.removeEventListener("resize", handleResize);
    }
  });
  return isLarger;
};