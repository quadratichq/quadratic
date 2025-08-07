import { useEffect, useState } from 'react';

export const Coordinates = () => {
  const [coordinates, setCoordinates] = useState('');

  useEffect(() => {
    const updateCoordinates = (e: PointerEvent) => {
      setCoordinates(`${Math.round(e.clientX)},${Math.round(e.clientY)}`);
    };
    window.addEventListener('pointermove', updateCoordinates);
    return () => {
      window.removeEventListener('pointermove', updateCoordinates);
    };
  });
  return <div>{coordinates}</div>;
};
